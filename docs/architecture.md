# CSP Bob Connector — Architecture

## Overview

The CSP Bob Connector extends IBM Bob's capabilities into the support domain by following the proven integration pattern used by IBM's Propel marketplace: Connection → Tool Definitions → Auth → External API. Where Propel provides the scaffolding, this project provides the first production-quality connector targeting an IBM internal support system, plus a reusable template for any team to replicate the pattern.

---

## 1. Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           IBM BOB (IDE / Agent)                              │
│                                                                              │
│   User prompt ──► Support Intelligence Skill (custom mode + system prompt)  │
│                              │                                               │
│                         Tool calls                                           │
│                              │                                               │
│           ┌──────────────────┼──────────────────┐                            │
│           ▼                  ▼                  ▼                            │
│   csp_search_cases    csp_get_case    csp_get_related_docs                  │
│           │                  │                  │                            │
│           └──────────────────┴──────────────────┘                            │
│                              │  MCP Protocol (stdio)                         │
└──────────────────────────────┼───────────────────────────────────────────────┘
                               │
           ┌───────────────────▼──────────────────────┐
           │           CSP MCP SERVER                  │  ← NEW (this project)
           │        Node.js / TypeScript               │
           │                                           │
           │  ┌────────────────────────────────────┐   │
           │  │  Tool Handler Layer                │   │  ← NEW
           │  │  • Zod input validation            │   │  [Propel pattern: P2]
           │  │  • Error → isError response        │   │
           │  └─────────────────┬──────────────────┘   │
           │                    │                       │
           │  ┌─────────────────▼──────────────────┐   │
           │  │  Auth Layer (IamTokenManager)       │   │  ← Pattern from Propel [P3]
           │  │  • IBM App ID client_credentials    │   │
           │  │  • 24h token cache + auto-refresh   │   │
           │  └─────────────────┬──────────────────┘   │
           │                    │                       │
           │  ┌─────────────────▼──────────────────┐   │
           │  │  CSP HTTP Client (CspClient)        │   │  ← NEW
           │  │  • axios with 15s timeout           │   │
           │  │  • Retry on 429/503                 │   │
           │  │  • Response normalizer              │   │
           │  │  • FIXTURE_MODE bypass              │   │
           └──┴─────────────────┬──────────────────┴───┘
                                │  HTTPS
           ┌────────────────────▼──────────────────────┐
           │  IBM API Gateway + SF Case Bot             │  ← EXTERNAL (IBM internal)
           │  POST /api/v1/automate (case actions)      │
           │  POST /api/v1/case_feed (case detail)      │
           └───────────────────────────────────────────┘
                                │
           ┌────────────────────▼──────────────────────┐
           │  CSP (Cognitive Support Platform)          │  ← EXTERNAL (IBM internal)
           │  Salesforce-based, IBM internal only       │
           └───────────────────────────────────────────┘
```

**Legend:**
- `← Pattern from Propel [Px]` — adapted from Propel marketplace pattern
- `← NEW` — net-new code authored during this project
- `← EXTERNAL` — system we do not control

---

## 2. Component Descriptions

### Support Intelligence Skill
A Bob custom mode with a system prompt (`skill/prompts/analyze.md`) that instructs the agent to search CSP before reasoning, cite every claim, report confidence, and never fabricate root causes. The skill orchestrates the 5-step workflow below and enforces guardrails G1–G7. Invocable via natural language or the `/support-search` slash command.

### MCP Server (`mcp-server/src/index.ts`)
A Node.js process communicating over stdio using the `@modelcontextprotocol/sdk`. It registers three tools (`csp_search_cases`, `csp_get_case`, `csp_get_related_docs`) and routes `tools/call` requests to the appropriate handler. All tool inputs are validated by Zod before reaching the client layer. Errors are caught and returned as `{ isError: true }` responses rather than crashes.

### Tool Handler Layer
Thin routing logic inside `index.ts`. Each branch: (1) parses + validates input with Zod, (2) calls the corresponding `CspClient` method, (3) serializes the response as `content: [{ type: "text", text: JSON.stringify(...) }]`. Zod parse errors and `CspApiError` are both caught by the outer try/catch and returned as tool errors.

### Auth Layer (`src/auth/iam_auth.ts`)
An `IamTokenManager` class that obtains OAuth2 tokens from IBM App ID using the `client_credentials` grant. Tokens are cached in memory for their 24-hour lifetime, with automatic refresh 5 minutes before expiry. Credentials are injected via environment variables (`CSP_CLIENT_ID`, `CSP_CLIENT_SECRET`). The token manager is injected into `CspClient` at startup.

### CSP HTTP Client (`src/client/csp_client.ts`)
A typed wrapper around axios. Three public methods: `searchCases()`, `getCase()`, `getRelatedDocs()`. Each method builds the appropriate request body for the IBM API Gateway action protocol (`action: "sf_case_search"` etc.), attaches the Bearer token from the auth layer, and normalizes the raw API response into the typed domain interfaces. Non-2xx responses throw `CspApiError(statusCode, message)`.

### Fixture Mode
When `FIXTURE_MODE=true` is set, `CspClient` reads `test/fixtures/csp_responses.json` at startup and routes all method calls to in-memory fixture data. Keyword routing matches common patterns (OOM → search_OOM_watsonx, SSL/TLS → search_SSL_COS, timeout → search_timeout_governance). The server is otherwise identical to live mode — Bob cannot tell the difference. This is the primary demo path.

---

## 3. Skill Workflow Diagram

```
User Input: "Search CSP for Kubernetes OOM errors in watsonx.data"
         │
         ▼
[Step 1: search] ──────────────────────────────────────────────────────────────
  csp_search_cases(keywords="Kubernetes OOM watsonx.data", limit=10)
         │
         ├──► { total: 4, cases: [{case_id, title, description_snippet, url}, ...] }
         │
         │    If total == 0 ──► STOP: "INSUFFICIENT confidence, no cases found"
         │
         ▼
[Step 2: enrich] ──────────────────────────────────────────────────────────────
  csp_get_case(case_id) × top 3 cases    [parallel, max 3]
         │
         ├──► Full case detail for each: description, resolution, root_cause, env
         │
         ▼
[Step 3: docs] ─────────────────────────────────────────────────────────────────
  csp_get_related_docs(keywords)    [optional, skip if no KB source]
         │
         ├──► Related KB articles: article_id, title, snippet, url
         │
         ▼
[Step 4: analyze] ──────────────────────────────────────────────────────────────
  Bob LLM with system prompt from skill/prompts/analyze.md
         │
         Inputs:  case_details[] + articles[] + user_query
         │
         Rules enforced:
          • Cite every claim with [CSP:case_id] or [KB:article_id]
          • Only hypothesize what evidence supports
          • Assign confidence: HIGH / MEDIUM / LOW / INSUFFICIENT
          • Never repeat PII from case data
         │
         ▼
[Step 5: output] ───────────────────────────────────────────────────────────────
  Validated structured response:
         {
           summary:                "Pattern found: JVM heap undersizing...",
           root_cause_hypotheses:  [{ hypothesis, evidence_case_ids, confidence }],
           recommended_actions:    [{ action, rationale, source_citation }],
           citations:              [{ case_id, url, snippet, source_type }],
           confidence_level:       "HIGH",
           confidence_rationale:   "Three independent cases corroborate..."
         }
```

---

## 4. Guardrail Enforcement Table

| Guardrail | Rule summary | Where enforced |
|---|---|---|
| **G1** Search before reasoning | Always call `csp_search_cases` first; never answer from memory | System prompt (first rule); tool description says "Always call this before…" |
| **G2** Cite every claim | Every factual claim needs a `[CSP:id]` citation | System prompt instruction + output schema requires `citations` array |
| **G3** Report confidence always | Every response must include `confidence_level` + `confidence_rationale` | Output schema validation; both fields are `required: true` |
| **G4** Never fabricate | Only hypothesize from retrieved evidence; stop if no evidence | System prompt first paragraph; hypothesis array validated against citations |
| **G5** Bound tool calls | Max 3 parallel `csp_get_case` calls; max 2 tool types per run | `max_parallel_calls: 3` in `skill-spec.yaml`; MCP server per-request timeout |
| **G6** Tag source type | Distinguish `CSP_CASE` from `KB_ARTICLE` in citations | `source_type` enum field required in citations output schema |
| **G7** Respect data sensitivity | No raw PII (customer names, emails) in output | System prompt instruction; MCP middleware PII scrub layer (planned) |

---

## 5. Design Decisions

### Why the Propel integration pattern?
The Propel marketplace establishes a proven, structured approach to Bob integrations: each extension is a stateless MCP server that exposes typed tools via a well-defined schema. Adopting this pattern means the CSP connector is immediately recognisable to any IBM developer familiar with Propel, and the connector template we've produced can be submitted back to the Propel ecosystem as a contribution.

### Why MCP over direct API calls?
MCP gives Bob a language-agnostic, versioned, discoverable interface to external systems. If we had embedded CSP API calls inside a custom mode prompt, every change to the CSP API would require re-editing the Bob configuration. With MCP, the tool schema is the contract — Bob adapts to it automatically, and the server can be updated independently.

### Why fixture mode is built-in from day one?
CSP is an IBM-internal system. Network access is VPN-dependent, credentials require provisioning, and the API shape was partially unknown at project start. Fixture mode decouples development and demo reliability from live system availability. It also serves as the foundation for unit testing — the same fixtures used for CI are the ones shown in the demo.

---

## 6. Repository Structure

```
csp-bob-connector/
├── README.md                         ← Project overview and setup
├── PLAN.md                           ← Full project plan
├── CONTRIBUTING.md                   ← How to add a new connector
├── LICENSE                           ← Apache 2.0
│
├── mcp-server/
│   ├── src/
│   │   ├── index.ts                  ← MCP server entry point (3 tools)
│   │   ├── client/csp_client.ts      ← HTTP client + fixture mode
│   │   └── auth/iam_auth.ts          ← IBM App ID OAuth2 token manager
│   └── test/
│       ├── tools.test.ts             ← Jest unit tests (ts-jest)
│       └── fixtures/csp_responses.json ← Canned responses for all 3 queries
│
├── skill/
│   ├── skill-spec.yaml               ← Formal skill schema (generic template)
│   └── prompts/analyze.md            ← Agent system prompt with guardrails
│
├── connector-template/               ← Reusable template for new connectors
│   ├── index-template.ts
│   ├── client-template.ts
│   ├── auth-template.ts
│   └── HOWTO.md
│
└── docs/
    ├── architecture.md               ← This file
    ├── guardrails.md                 ← Detailed guardrail documentation
    ├── demo-script.md                ← 5-minute demo script
    └── bob-prompt-log.md             ← All Bob prompts used during development
```
