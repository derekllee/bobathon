# CSP Bob Connector

> **Bobathon 2025 — Team B**

Connect IBM Bob to IBM CSP (Cognitive Support Platform) to search historical support cases, analyze root causes, and get cited recommendations — all without leaving your IDE.

---

## What this is

IBM support engineers and developers spend significant time manually searching CSP for historical cases relevant to the issue they are debugging. This context — what broke before, how it was resolved, what documentation applied — lives in CSP but is invisible inside the tools where engineers actually work: their IDE and AI assistant.

This project closes that gap. It extends IBM Bob with a **Support Intelligence** connector built on the same layered architecture used by IBM's Propel marketplace. A developer asks Bob about a production incident in plain English and receives a structured analysis: matched case summaries, cited root-cause hypotheses, recommended actions, and a confidence level — all grounded in real closed cases.

The connector is packaged as:
- A **working CSP connector** with fixture mode for demos and CI
- A **connector factory** so any team can wire Bob to any internal system in under 2 hours

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        IBM BOB (IDE / Agent)                        │
│                                                                     │
│  User prompt ──► Support Intelligence (custom mode + system prompt) │
│                              │                                      │
│         ┌────────────────────┼────────────────────┐                 │
│         ▼                    ▼                    ▼                 │
│  csp_search_cases     csp_get_case     csp_get_related_docs         │
│         └────────────────────┼────────────────────┘                 │
│                              │  MCP Protocol (stdio)                │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
           ┌───────────────────▼──────────────────────┐
           │           CSP MCP Server                  │
           │        Node.js / TypeScript               │
           │                                           │
           │  Tool Handler  (Zod input validation)     │
           │       │                                   │
           │  Auth Layer    (IBM App ID OAuth2)         │
           │       │                                   │
           │  HTTP Client   (axios + FIXTURE_MODE)     │
           └───────────────────┬──────────────────────┘
                               │  HTTPS
           ┌───────────────────▼──────────────────────┐
           │  IBM API Gateway (Code Engine)            │
           │    → Salesforce / CSP                     │
           └──────────────────────────────────────────┘
```

See [`docs/architecture.md`](docs/architecture.md) for the full diagram, workflow steps, guardrail table, and design decisions.

---

## Prerequisites

- **Node.js 20+**
- **IBM App ID credentials** with CSP access (`CSP_CLIENT_ID`, `CSP_CLIENT_SECRET`)
  - Stored in 1Password → Vault: "CSP Test Automation" → Item: "API case requests SF_Bot/API_Gateway"
- **IBM Bob IDE** installed and running
- Network access to IBM internal systems (VPN required for live mode)

No credentials needed for demo/fixture mode — see below.

---

## Setup

```bash
# 1. Clone and install
git clone https://github.com/your-org/csp-bob-connector.git
cd csp-bob-connector

npm install

# 2. Build
npm run build

# 3. Configure credentials (live mode only)
cp .env.example .env
# Edit .env — set CSP_CLIENT_ID and CSP_CLIENT_SECRET
```

---

## Register with Bob

Add the following to your Bob MCP configuration file (`.bob/mcp.json` in your workspace root):

```json
{
  "mcpServers": {
    "csp-connector": {
      "command": "node",
      "args": ["/absolute/path/to/csp-bob-connector/dist/mcp-server/src/index.js"],
      "env": {
        "CSP_CLIENT_ID":      "your-client-id",
        "CSP_CLIENT_SECRET":  "your-client-secret",
        "CSP_API_GATEWAY_URL": "https://api-gateway-prod.sl2g9er7sj9.us-south.codeengine.appdomain.cloud",
        "CSP_SF_CASE_BOT_URL": "https://sf-case-bot-prod.sl2g9er7sj9.us-south.codeengine.appdomain.cloud"
      }
    }
  }
}
```

For demo or development mode with no credentials required:

```json
"env": { "FIXTURE_MODE": "true" }
```

Restart Bob after editing the config.

---

## Try it

Switch Bob to the **Support Intelligence** mode, then type:

```
Search CSP for historical cases about Kubernetes OOM errors in watsonx.data
```

Expected response:
- Matched case summaries with titles, snippets, and direct CSP links
- Root cause hypotheses citing specific case IDs (`[CSP:TS012483901]`)
- Recommended actions with source citations and rationale
- Confidence level: **HIGH / MEDIUM / LOW / INSUFFICIENT**

More example prompts:

```
Find historical cases related to SSL handshake failures in IBM Cloud Object Storage

What do past support cases say about connection pool timeouts in watsonx.governance?

Get full details for case 500DyA3K8mNpQ7rXv2Wj
```

---

## Run tests

```bash
npm test
```

The test suite uses `ts-jest` with a fully mocked `CspClient`. **No live CSP access required.**

```
PASS mcp-server/test/tools.test.ts
  ✓ 1. happy path — returns cases from CspClient
  ✓ 2. empty results — no error, empty array
  ✓ 3. CspApiError 401 — isError true, message contains 'authentication'
  ✓ 4. CspApiError 500 — isError true
  ✓ 5. missing keywords (empty string) — Zod validation error, isError true
  ✓ 5b. missing keywords entirely — isError true
  ✓ 6. happy path — returns full case detail with all required fields
  ✓ 7. CspApiError 404 — isError true, message contains case_id
  ✓ 7b. missing case_id — Zod validation error, isError true
  ✓ 8. happy path — returns articles array
  ✓ 9. empty docs — no error, empty articles array
  ✓ 10. returns isError true with unknown tool name

Tests: 12 passed, 12 total   Time: ~0.25s
```

---

## Agentic guardrails

Seven rules govern every response the Support Intelligence agent produces. They are enforced at three independent layers — system prompt, output schema, and MCP middleware — so a failure at one layer is caught by the next.

| ID | Rule | Prevents |
|---|---|---|
| **G1** | Search before reasoning — always call `csp_search_cases` first | Hallucinated root causes |
| **G2** | Cite every claim with `[CSP:case_id]` | Fabricated evidence |
| **G3** | Report confidence level on every response (HIGH / MEDIUM / LOW / INSUFFICIENT) | Over-trusting low-evidence responses |
| **G4** | Never fabricate root causes — only hypothesize from retrieved cases | Confident wrong answers |
| **G5** | Bound tool calls — max 3 `csp_get_case` fetches per query | Unbounded API fan-out |
| **G6** | Tag source type — distinguish `CSP_CASE` from `KB_ARTICLE` | Conflating resolutions with documentation |
| **G7** | Respect data sensitivity — no raw PII from case descriptions | Customer data leaking into IDE sessions |

See [`docs/guardrails.md`](docs/guardrails.md) for the full ruleset, enforcement details, and customization guidance.

---

## Fixture data

Three realistic datasets are bundled for demo and CI use. Activate with `FIXTURE_MODE=true`:

| Dataset | Cases | Status | Product |
|---|---|---|---|
| OOM / JVM heap exhaustion | 4 | All closed | watsonx.data |
| SSL handshake failures | 3 | 2 closed, 1 open | IBM Cloud Object Storage |
| Connection pool timeouts | 3 | All closed | watsonx.governance |

---

## Add a new connector

The `connector-template/` directory contains everything needed to connect Bob to any internal system using the same pattern as this CSP connector.

```bash
cp -r connector-template/ my-system-connector/
cd my-system-connector/
grep -r "\[CUSTOMIZE" src/   # find all placeholders
```

See [`connector-template/HOWTO.md`](connector-template/HOWTO.md) for the 7-step guide.  
See [`CONTRIBUTING.md`](CONTRIBUTING.md) for PR requirements and the connector checklist.

The template takes approximately 2 hours to adapt for a new system. All domain-specific logic is marked with `[CUSTOMIZE]` comments.

---

## Repository structure

```
.
├── csp-bob-connector/
│   ├── mcp-server/
│   │   ├── src/
│   │   │   ├── index.ts                  MCP server entry point (3 tools)
│   │   │   ├── client/csp_client.ts      HTTP client + fixture mode
│   │   │   └── auth/iam_auth.ts          IBM App ID OAuth2 token manager
│   │   └── test/
│   │       ├── tools.test.ts             Jest unit tests (12 tests)
│   │       └── fixtures/csp_responses.json   Canned responses for 3 query domains
│   ├── docs/
│   │   ├── architecture.md              Full architecture + workflow diagrams
│   │   ├── guardrails.md                G1–G7 enforcement specification
│   │   ├── csp-api-notes.md             IBM App ID endpoints + Salesforce field names
│   │   └── runbook.md                   Operations guide (auth, outages, credential rotation)
│   ├── README.md                        Connector-specific setup guide
│   └── CONTRIBUTING.md                  How to add a new connector
│
├── skill/
│   ├── skill-spec.yaml                  Formal skill definition (workflow, output schema, guardrails)
│   └── prompts/analyze.md               Agent system prompt
│
├── connector-template/
│   ├── index-template.ts                MCP server boilerplate with [CUSTOMIZE] markers
│   ├── client-template.ts               HTTP client boilerplate
│   ├── auth-template.ts                 OAuth2 token manager boilerplate
│   └── HOWTO.md                         7-step new connector guide
│
├── docs/
│   ├── architecture.md                  Top-level architecture narrative
│   └── demo-script.md                   5-minute demo script with timing and panic plan
│
└── .bob/
    ├── mcp.json                         Bob MCP server registration
    └── custom_modes.yaml                "Support Intelligence" Bob mode definition
```

---

## License

Apache License 2.0. See [LICENSE](LICENSE).
