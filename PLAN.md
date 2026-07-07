# Bob–CSP Support Search Extension — Hackathon Project Plan

> **Track:** Integration: Extend Bob  
> **Constraint:** One day (~8am–6pm, ~10 productive hours)  
> **MVP definition:** One working MCP tool (`csp_search_cases`) callable from Bob with cited results  
> **Stretch goal:** Full Support Intelligence Skill, docs retrieval, confidence scoring, generic connector template

---

## 1. Problem Statement & Solution

### Problem
IBM support engineers and developers spend significant time manually searching CSP (Cognitive Support Platform) for historical cases relevant to the issue they're debugging. This context — what broke before, how it was resolved, what documentation applied — lives in CSP but is invisible inside the tools where engineers actually work: their IDE and AI assistant.

### Solution
We extend IBM Bob with a **Support Intelligence connector** built on the same layered architecture used by the Propel marketplace (Connection → Tool Definitions → Auth → External API). A developer can ask Bob "find CSP cases related to Kubernetes OOM errors in watsonx.data" and receive analyzed results: matched case summaries, root-cause hypotheses, recommended actions, and citations (case ID + URL + snippet) with a stated confidence level. The connector is packaged as a reusable Skill and a documented connector template so any team can wire Bob to any internal support or knowledge system using the same pattern.

---

## 2. Propel Reverse-Engineering Checklist

> ⚠️ **GHE access required.** Execute this checklist first thing in the morning (08:00–08:45).  
> Repo target: `github.ibm.com/productivity-platforms/propel-marketplace`

| # | Question | Where to look in repo | What to capture |
|---|----------|----------------------|-----------------|
| P1 | What is a **Connection** concretely — MCP server config? tool manifest? metadata schema? | `CONTRIBUTING.md` §Connection; `/connections/` or `/connectors/` top-level dir | Directory structure, required files |
| P2 | What is a **Skill** concretely — workflow YAML? prompt chain? custom mode file? | `CONTRIBUTING.md` §Skill; `/skills/` dir; any `.yaml`/`.json` skill definitions | Schema fields, required keys |
| P3 | How are **auth & secrets** handled — env vars, vault, OAuth flow, IBM IAM? | `CONTRIBUTING.md` §Auth; any `auth.ts`/`auth.py`/`config.yaml` in a sample connector | Secret key names, injection pattern |
| P4 | How are extensions **registered in the marketplace** — PR to a manifest? CLI publish? config file? | `CONTRIBUTING.md` §Publishing or §Registration; `marketplace.json` or `registry.yaml` | Registration file format |
| P5 | What does **packaging** require — npm build? Docker image? zip artifact? | `CONTRIBUTING.md` §Packaging; any `Makefile`, `package.json`, `pyproject.toml` in samples | Build commands, output format |
| P6 | What is the **MCP server transport** — stdio? SSE? HTTP? | Any existing connector's server entry point | Transport type, port conventions |
| P7 | What language/runtime are existing connectors written in? | `/connections/*/` — look for `package.json`, `requirements.txt`, `go.mod` | Language, framework |
| P8 | Is there a **connector template** or scaffold already? | `CONTRIBUTING.md` §Getting Started; `/template/` or `/scaffold/` dir | Template files to copy |
| P9 | How does Bob **invoke** a Skill — slash command? natural language? explicit tool call? | `CONTRIBUTING.md` §Usage; any skill's `README.md` | Invocation syntax |
| P10 | What **testing pattern** do existing connectors use? | `/connections/*/test*` or `__tests__` dirs | Test framework, mock patterns |

**Decision gate:** If P1–P5 are unresolved by 09:00, pivot to the fallback architecture (standalone MCP server, no Propel packaging, registered manually in Bob's local config).

---

## 3. Target Architecture

### 3a. Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        IBM BOB (IDE / Agent)                        │
│                                                                     │
│  User prompt ──► Support Intelligence Skill (custom mode / workflow)│
│                        │                                            │
│                   Tool calls                                        │
│                        │                                            │
│         ┌──────────────┼──────────────┐                             │
│         ▼              ▼              ▼                             │
│  csp_search_cases  csp_get_case  csp_get_related_docs              │
│         │              │              │                             │
│         └──────────────┴──────────────┘                             │
│                        │  MCP Protocol (stdio / SSE)                │
└────────────────────────┼────────────────────────────────────────────┘
                         │
         ┌───────────────▼────────────────┐
         │    CSP MCP SERVER              │  ← NEW (this project)
         │  (Node.js / Python)            │
         │                                │
         │  ┌─────────────────────────┐   │
         │  │  Tool Handler Layer     │   │  ← NEW
         │  └────────────┬────────────┘   │
         │               │                │
         │  ┌────────────▼────────────┐   │
         │  │  Auth Layer             │   │  ← Pattern from Propel [P3]
         │  │  (IAM token / session)  │   │
         │  └────────────┬────────────┘   │
         │               │                │
         │  ┌────────────▼────────────┐   │
         │  │  CSP HTTP Client        │   │  ← NEW
         │  │  (axios / httpx)        │   │
         └──┴────────────┬────────────┴───┘
                         │  HTTPS
         ┌───────────────▼────────────────┐
         │    CSP (Cognitive Support      │  ← EXTERNAL (IBM internal)
         │    Platform) API / Web UI      │
         └────────────────────────────────┘
```

**Legend:**
- `← Pattern from Propel [Px]` — copied/adapted from Propel; validate with checklist item Px
- `← NEW` — net-new code for this project
- `← EXTERNAL` — system we do not control

### 3b. Support Intelligence Skill Flow

```
User Input: keywords / case_id / symptom description
         │
         ▼
[Step 1] csp_search_cases(keywords, filters={product, severity}, limit=10)
         │
         ├─► Ranked list of matching cases (id, title, snippet, url)
         │
         ▼
[Step 2] csp_get_case(case_id) × top 3 cases   [parallel]
         │
         ├─► Full case detail (description, resolution, env, components)
         │
         ▼
[Step 3] csp_get_related_docs(keywords)          [optional / stretch]
         │
         ├─► Related KB articles / runbooks
         │
         ▼
[Step 4] Analysis prompt (Bob LLM)
         │  Inputs: case details + docs
         │  Instructions: identify patterns, hypothesize root causes,
         │                never fabricate, cite every claim, score confidence
         │
         ▼
[Step 5] Structured output
         {
           summary: string,
           root_cause_hypotheses: [{hypothesis, evidence_case_ids, confidence}],
           recommended_actions: [{action, rationale, source_citation}],
           citations: [{case_id, url, snippet}],
           confidence_level: "HIGH|MEDIUM|LOW",
           confidence_rationale: string
         }
```

---

## 4. CSP Integration Spec

> All items below are ASSUMPTIONS until validated. Validation method listed per item.

### 4a. Auth

| Field | Assumption | Validation Step |
|-------|-----------|-----------------|
| Auth type | `ASSUMPTION[csp-auth-1]` IBM IAM w/ API key or w3id SSO session cookie | Inspect network tab in CSP web UI login flow; ask CSP team (#csp-dev Slack) |
| Token endpoint | `ASSUMPTION[csp-auth-2]` `https://iam.cloud.ibm.com/identity/token` | Check IAM docs; or network trace |
| Token lifetime | `ASSUMPTION[csp-auth-3]` 3600s; refresh via client_credentials grant | IAM docs |
| Session cookie name | `ASSUMPTION[csp-auth-4]` `LtpaToken2` or similar (IBM WebSphere pattern) | Browser DevTools → Application → Cookies on CSP domain |

### 4b. Search Endpoint

```
ASSUMPTION[csp-search-1]
POST https://csp.ibm.com/api/v1/cases/search
  OR
GET  https://csp.ibm.com/api/v1/cases?q={keywords}&product={product}&limit={n}

Headers:
  Authorization: Bearer {iam_token}
  Content-Type: application/json

Request body (POST variant):
{
  "query": "string",
  "filters": {
    "product": "string",        // e.g. "watsonx.data"
    "severity": "1|2|3|4",
    "status": "open|closed|all",
    "date_from": "ISO8601"
  },
  "limit": 10,
  "offset": 0
}

Response (assumed):
{
  "total": 42,
  "cases": [
    {
      "case_id": "TS012345678",
      "title": "string",
      "description_snippet": "string",
      "product": "string",
      "severity": "2",
      "status": "closed",
      "resolution_summary": "string",
      "created_at": "ISO8601",
      "url": "https://csp.ibm.com/cases/TS012345678"
    }
  ]
}
```

**Validation:** Open CSP web UI, perform a search, inspect `Network` tab for XHR/Fetch calls. Record actual endpoint, method, headers, and payload shape.

### 4c. Get Case Endpoint

```
ASSUMPTION[csp-case-1]
GET https://csp.ibm.com/api/v1/cases/{case_id}

Response (assumed):
{
  "case_id": "TS012345678",
  "title": "string",
  "description": "string (full)",
  "environment": { "platform": "...", "version": "..." },
  "components": ["string"],
  "resolution": "string",
  "root_cause": "string",
  "attachments": [{ "name": "string", "url": "string" }],
  "updates": [{ "timestamp": "ISO8601", "author": "string", "text": "string" }],
  "url": "https://csp.ibm.com/cases/TS012345678"
}
```

### 4d. Related Docs Endpoint

```
ASSUMPTION[csp-docs-1]
GET https://csp.ibm.com/api/v1/knowledge?q={keywords}&case_id={case_id}

Response (assumed):
{
  "articles": [
    {
      "article_id": "string",
      "title": "string",
      "snippet": "string",
      "url": "string"
    }
  ]
}
```

### 4e. Fallback Plan (if no sanctioned API exists)

**Tier 1 — Authenticated HTTP scraping:**  
Use `playwright` (headless) or `axios` with session cookie harvested from the user's browser to replay the CSP web UI's search XHR calls. This is fragile but functional for a demo.

**Tier 2 — Thin proxy service:**  
Deploy a lightweight FastAPI service on an IBM Cloud Code Engine instance that authenticates with a shared service account and exposes a clean REST API. The MCP server talks to the proxy, not CSP directly.

**Tier 3 — Demo fixture mode:**  
If CSP access is wholly blocked on demo day, ship a `--fixture` flag that replays pre-recorded canned responses from `fixtures/csp_responses.json`. Judge sees the full end-to-end flow; data is real (captured earlier). **This must be implemented regardless as insurance.**

---

## 5. MCP Tool Definitions

### Tool 1: `csp_search_cases`

```json
{
  "name": "csp_search_cases",
  "description": "Search IBM CSP (Cognitive Support Platform) for historical support cases matching the given keywords. Returns ranked case summaries with IDs, titles, snippets, and URLs. Always call this before attempting root cause analysis.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "keywords": {
        "type": "string",
        "description": "Search terms describing the symptom or error (e.g. 'OOM error watsonx.data Kubernetes')"
      },
      "product": {
        "type": "string",
        "description": "IBM product name to scope the search (optional)"
      },
      "severity": {
        "type": "string",
        "enum": ["1", "2", "3", "4", "any"],
        "default": "any",
        "description": "Filter by case severity (1=critical, 4=low)"
      },
      "status": {
        "type": "string",
        "enum": ["open", "closed", "all"],
        "default": "all"
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 20,
        "default": 10
      }
    },
    "required": ["keywords"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "total": { "type": "integer" },
      "cases": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "case_id":            { "type": "string" },
            "title":              { "type": "string" },
            "description_snippet":{ "type": "string" },
            "product":            { "type": "string" },
            "severity":           { "type": "string" },
            "status":             { "type": "string" },
            "resolution_summary": { "type": "string" },
            "url":                { "type": "string", "format": "uri" }
          }
        }
      }
    }
  }
}
```

### Tool 2: `csp_get_case`

```json
{
  "name": "csp_get_case",
  "description": "Retrieve the full detail of a single CSP support case by case ID. Use after csp_search_cases to get resolution details, root cause, and environment info for top matches.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "case_id": {
        "type": "string",
        "description": "CSP case identifier (e.g. 'TS012345678')"
      }
    },
    "required": ["case_id"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "case_id":     { "type": "string" },
      "title":       { "type": "string" },
      "description": { "type": "string" },
      "resolution":  { "type": "string" },
      "root_cause":  { "type": "string" },
      "environment": { "type": "object" },
      "components":  { "type": "array", "items": { "type": "string" } },
      "url":         { "type": "string", "format": "uri" }
    }
  }
}
```

### Tool 3: `csp_get_related_docs`

```json
{
  "name": "csp_get_related_docs",
  "description": "Retrieve related IBM knowledge base articles and documentation for a set of keywords or a specific case. Use to supplement case analysis with official guidance.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "keywords": { "type": "string" },
      "case_id":  { "type": "string", "description": "Optional: scope docs to a specific case context" },
      "limit":    { "type": "integer", "default": 5, "maximum": 10 }
    },
    "required": ["keywords"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "articles": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "article_id": { "type": "string" },
            "title":      { "type": "string" },
            "snippet":    { "type": "string" },
            "url":        { "type": "string", "format": "uri" }
          }
        }
      }
    }
  }
}
```

### Citation Format

Every claim in agent output must carry a citation in this format:

```
[CSP:TS012345678] "Resolution: increased JVM heap to 8GB resolves OOM on startup."
  → https://csp.ibm.com/cases/TS012345678
```

### Confidence Level Rubric

| Level | Criteria |
|-------|----------|
| **HIGH** | ≥3 cases with matching symptoms AND matching resolution pattern; docs corroborate |
| **MEDIUM** | 1–2 cases match symptoms; resolution pattern partially consistent |
| **LOW** | Symptom match only; no resolution data; conflicting signals |
| **INSUFFICIENT** | Fewer than 1 relevant case found; agent must say so and stop |

---

## 6. Support Intelligence Skill Spec

> Written as a reusable schema. A different team fills in the `domain_*` fields to create a new Skill.

```yaml
# skill-spec.yaml — Support Intelligence Skill
# Generic connector skill schema v1.0
# To create a new skill: copy this file, fill in all fields marked [CUSTOMIZE]

skill:
  id: support-intelligence-csp              # [CUSTOMIZE] unique slug
  version: "0.1.0"
  display_name: "Support Intelligence"      # [CUSTOMIZE]
  description: >                            # [CUSTOMIZE]
    Search IBM CSP for historical support cases matching the user's
    symptom description. Analyze patterns, hypothesize root causes,
    recommend actions, and cite every claim.
  icon: "support"                           # [CUSTOMIZE]

# --- Trigger Configuration ---
trigger:
  invocation: natural_language              # natural_language | slash_command | explicit
  slash_command: "/support-search"          # [CUSTOMIZE] if slash_command
  example_prompts:                          # [CUSTOMIZE]
    - "Find CSP cases related to {symptom}"
    - "What do historical cases say about {error}?"
    - "Search support history for {product} {error}"

# --- Connector Bindings ---
connectors:                                 # [CUSTOMIZE] list the MCP tools this skill uses
  - tool: csp_search_cases
    required: true
    call_order: 1
  - tool: csp_get_case
    required: false
    call_order: 2
    max_parallel_calls: 3
  - tool: csp_get_related_docs
    required: false
    call_order: 3

# --- Agent Workflow Steps ---
workflow:
  - step: search
    description: "Call csp_search_cases with extracted keywords"
    tool: csp_search_cases
    input_mapping:
      keywords: "{{extract_keywords(user_input)}}"
      product:  "{{extract_product(user_input) | optional}}"
      limit:    10

  - step: enrich
    description: "Fetch full detail for top N results"
    tool: csp_get_case
    input_mapping:
      case_id: "{{search.cases[0:3].case_id}}"
    parallel: true

  - step: docs                              # [CUSTOMIZE] skip if domain has no docs source
    description: "Fetch related documentation"
    tool: csp_get_related_docs
    input_mapping:
      keywords: "{{user_input}}"
    required: false

  - step: analyze
    description: "LLM analysis with guardrails"
    type: llm_prompt
    prompt_template: prompts/analyze.md     # [CUSTOMIZE]

  - step: output
    description: "Structured response"
    format: support_intelligence_response_v1

# --- Output Schema ---
output_format:
  id: support_intelligence_response_v1
  fields:
    summary:                  { type: string, required: true }
    root_cause_hypotheses:    { type: array,  required: true }
    recommended_actions:      { type: array,  required: true }
    citations:                { type: array,  required: true }
    confidence_level:         { type: enum,   values: [HIGH, MEDIUM, LOW, INSUFFICIENT] }
    confidence_rationale:     { type: string, required: true }

# --- Guardrails ---
guardrails:                                 # [CUSTOMIZE] add domain-specific rules
  - id: G1
    rule: "Always call csp_search_cases before analysis. Never analyze from memory alone."
    enforcement: system_prompt
  - id: G2
    rule: "Every claim must cite a case_id or article_id. No uncited assertions."
    enforcement: output_validation
  - id: G3
    rule: "Always output a confidence_level. If INSUFFICIENT, stop and say so."
    enforcement: output_validation
  - id: G4
    rule: "Never fabricate root causes. Only hypothesize from evidence in retrieved cases."
    enforcement: system_prompt
  - id: G5
    rule: "Search at most 3 external systems per query. Do not chain unbounded tool calls."
    enforcement: tool_call_limit
```

---

## 7. Agentic Best Practices — Guardrail Ruleset

### Numbered Rules

| # | Rule | Enforcement Mechanism |
|---|------|-----------------------|
| G1 | **Search before reasoning.** Always retrieve CSP data before forming a hypothesis. Never answer from training knowledge alone for support queries. | System prompt first line; tool description includes "Always call this before..." |
| G2 | **Cite every claim.** Every factual statement in the response must reference a `case_id` or `article_id` in the citations array. | Output schema validation; agent prompt instructs "do not make a claim without a citation" |
| G3 | **Report confidence always.** Every response must include a `confidence_level` (HIGH/MEDIUM/LOW/INSUFFICIENT) and a one-sentence `confidence_rationale`. | Required output schema field; if missing, response is rejected |
| G4 | **Never fabricate root causes.** Root cause hypotheses must be supported by at least one retrieved case. If no evidence exists, output `confidence_level: INSUFFICIENT` and stop. | System prompt; output validator checks hypothesis array against citation array |
| G5 | **Bound tool calls.** Maximum 3 parallel `csp_get_case` calls per query. Maximum 2 total tool types invoked per workflow run. | `max_parallel_calls` in skill spec; MCP server enforces a per-request timeout |
| G6 | **Distinguish case data from docs data.** Citations must tag their source type (`CSP_CASE` vs `KB_ARTICLE`). Do not conflate support resolution with product documentation. | Citation schema includes `source_type` enum |
| G7 | **Respect data sensitivity.** Do not repeat raw PII (customer names, emails) from case descriptions in the output. Summarize only. | System prompt; PII scrubber pass before returning tool output |

### Enforcement Architecture

```
[System Prompt]         → G1, G4, G7 (behavioral constraints)
[Tool Descriptions]     → G1 (first sentence of each tool description)
[Output Schema]         → G2, G3, G4, G6 (structural validation)
[Skill Spec limits]     → G5 (max_parallel_calls, tool_call_limit)
[MCP Server middleware] → G5, G7 (timeout guard, PII scrub)
```

---

## 8. Repository Structure

```
csp-bob-connector/
├── README.md                        # Project overview, setup, demo instructions
├── PLAN.md                          # This file
├── CONTRIBUTING.md                  # How to add a new connector using the template
├── LICENSE                          # Apache 2.0
│
├── mcp-server/                      # The MCP server (Node.js or Python TBD per P7)
│   ├── package.json / pyproject.toml
│   ├── src/
│   │   ├── index.ts (or main.py)    # MCP server entry point, transport setup
│   │   ├── tools/
│   │   │   ├── csp_search_cases.ts  # Tool 1 handler
│   │   │   ├── csp_get_case.ts      # Tool 2 handler
│   │   │   └── csp_get_related_docs.ts  # Tool 3 handler
│   │   ├── client/
│   │   │   └── csp_client.ts        # HTTP client for CSP API (or scraper)
│   │   ├── auth/
│   │   │   └── iam_auth.ts          # Token management, refresh logic
│   │   └── middleware/
│   │       ├── pii_scrubber.ts      # G7: strip PII from tool output
│   │       └── rate_limiter.ts      # G5: per-request limits
│   └── test/
│       ├── tools.test.ts            # Unit tests with mocked CSP responses
│       └── fixtures/
│           └── csp_responses.json   # Canned responses for demo/test fixture mode
│
├── skill/
│   ├── skill-spec.yaml              # Formal skill definition (§6 schema)
│   ├── prompts/
│   │   └── analyze.md               # Analysis step prompt template
│   └── README.md                    # How to invoke the skill in Bob
│
├── connector-template/              # Generic template for NEW connectors
│   ├── skill-spec.template.yaml     # skill-spec.yaml with [CUSTOMIZE] markers
│   ├── tool-template.ts             # Boilerplate tool handler
│   ├── client-template.ts           # Boilerplate HTTP client
│   └── HOWTO.md                     # Step-by-step guide to add a new connector
│
├── docs/
│   ├── architecture.md              # Architecture diagram + narrative
│   ├── csp-api-notes.md             # Network trace findings, validated endpoints
│   ├── guardrails.md                # Agentic best practices (§7)
│   ├── demo-script.md               # 5-minute demo script (§13)
│   └── bob-prompt-log.md            # Log of every Bob prompt used (deliverable)
│
└── .github/
    └── workflows/
        └── ci.yml                   # Lint + unit tests on push
```

### README Outline

1. What this is (2 sentences)
2. Architecture diagram (copied from §3)
3. Prerequisites (Node/Python, IBM API key, CSP access)
4. Setup: `npm install` / `pip install`, set env vars
5. Run the MCP server locally
6. Register with Bob (config snippet)
7. Try it: example prompt
8. Run tests: `npm test` / `pytest`
9. Add a new connector (link to `connector-template/HOWTO.md`)
10. License

---

## 9. SDLC-with-Bob Matrix

| Phase | Task | Bob Prompt (verbatim draft) | Expected Output | Evidence to capture |
|-------|------|-----------------------------|-----------------|-------------------|
| **Design** | Reverse-engineer Propel architecture | `"Read the CONTRIBUTING.md I'm pasting. Extract: what is a Connection, what is a Skill, how are they registered, what files are required. Output a numbered checklist."` | Filled P1–P10 checklist | Screenshot of Bob's output; paste into `docs/` |
| **Design** | Validate CSP API shape | `"I've captured these network requests from the CSP UI [paste HAR]. Infer the REST API contract: endpoints, methods, request/response shapes. Flag any ambiguities."` | Draft CSP API spec | Bob output → `docs/csp-api-notes.md` |
| **Design** | Define output schema | `"Design a JSON output schema for an AI agent that analyzes support cases. It must include: summary, root cause hypotheses, recommended actions, citations (case_id, url, snippet), and a confidence level enum. Write as a JSON Schema."` | `output_schema.json` | Schema file in repo |
| **Requirements** | Write agentic guardrails | `"Write a formal numbered ruleset of agentic best practices for an AI agent that searches support databases. Rules must address: what data to retrieve first, citation requirements, confidence reporting, fabrication prevention, and tool call limits. Format as a table."` | G1–G7 ruleset | `docs/guardrails.md` |
| **Requirements** | Define acceptance criteria | `"Given this skill spec YAML [paste §6], write Gherkin-style acceptance criteria for each workflow step. Include happy path and 3 error scenarios."` | `test/acceptance.feature` | File in repo |
| **Development** | Scaffold MCP server | `"Generate a TypeScript MCP server skeleton using the @modelcontextprotocol/sdk package. It should register 3 tools: csp_search_cases, csp_get_case, csp_get_related_docs. Use stdio transport. Include a stub handler for each tool."` | `mcp-server/src/index.ts` | Committed file |
| **Development** | Implement CSP HTTP client | `"Write a TypeScript class CspClient that wraps axios. Methods: searchCases(params), getCase(id), getRelatedDocs(keywords). Auth: inject a Bearer token via constructor. Include retry logic for 429/503. Types derived from these JSON schemas: [paste]."` | `mcp-server/src/client/csp_client.ts` | Committed file |
| **Development** | Implement auth layer | `"Write a TypeScript IamTokenManager class that: fetches a token from the IBM IAM endpoint using client_credentials, caches it, refreshes 60s before expiry. Env vars: IAM_API_KEY, IAM_TOKEN_URL."` | `mcp-server/src/auth/iam_auth.ts` | Committed file |
| **Development** | Write skill prompt | `"Write a system prompt for an AI agent whose job is to analyze IBM support cases. The agent must: always cite sources as [CSP:case_id], never fabricate root causes, always output a confidence level (HIGH/MEDIUM/LOW/INSUFFICIENT), and stop if fewer than 1 relevant case is found. Max 300 words."` | `skill/prompts/analyze.md` | Committed file |
| **Development** | Build connector template | `"Take this working CSP connector code [paste]. Strip all CSP-specific logic and replace with [CUSTOMIZE] placeholder comments. Output a reusable template with a HOWTO.md explaining each placeholder."` | `connector-template/` dir | Committed files |
| **Testing** | Generate unit tests | `"Write Jest unit tests for the csp_search_cases tool handler. Mock the CspClient with these fixture responses [paste csp_responses.json]. Test: successful search, empty results, 401 auth error, 500 server error, malformed response. Assert output schema compliance."` | `mcp-server/test/tools.test.ts` | `npm test` passing screenshot |
| **Testing** | Generate mock fixtures | `"Given this CSP API response schema [paste], generate 5 realistic mock case responses for a query about 'Kubernetes OOM errors in watsonx.data'. Make them plausible and internally consistent. Output as JSON."` | `test/fixtures/csp_responses.json` | File in repo |
| **Testing** | Write integration smoke test | `"Write a shell script that starts the MCP server in fixture mode and sends one csp_search_cases tool call via JSON-RPC over stdin. Assert a 200 response with at least 1 case. Exit 0 on pass, 1 on fail."` | `test/smoke.sh` | CI run log |
| **Documentation** | Write README | `"Write a README.md for this project [paste repo structure + architecture diagram]. Include: what it does, architecture diagram, prerequisites, setup steps, how to run, example prompt, how to add a new connector. Use IBM documentation style."` | `README.md` | Final file |
| **Documentation** | Write guardrails doc | `"Expand this guardrail table [paste G1–G7] into a full document. For each rule: motivation (why it matters), enforcement mechanism, an example of the rule being triggered, and how a future connector author would customize it."` | `docs/guardrails.md` | Final file |
| **Documentation** | Generate prompt log | `"Compile all the prompts I used with you today into a structured log. Format: Phase \| Prompt \| Output summary \| Notes on what worked / didn't."` | `docs/bob-prompt-log.md` | Deliverable file |
| **Operations** | Generate runbook | `"Write an operations runbook for the CSP Bob connector MCP server. Sections: startup, health check, common errors (401, 429, 500) and remediation, how to update CSP credentials, how to add fixtures for demo mode."` | `docs/runbook.md` | File in repo |
| **Operations** | Bob experience feedback | `"Based on our session today [describe], write 500 words of honest feedback on using Bob as an SDLC assistant. Cover: what worked well, what was frustrating, what prompts needed multiple attempts, recommendations for improvement."` | `docs/bob-feedback.md` | Deliverable file |

---

## 10. Testing Plan

### Unit Tests (mocked, no live CSP needed)

| Test | Input | Expected Output | Pass Criteria |
|------|-------|-----------------|---------------|
| Search: happy path | `{keywords: "OOM watsonx.data"}` | `{total: N, cases: [...]}` | ≥1 case, all fields present, valid URLs |
| Search: empty results | `{keywords: "zzznomatch9999"}` | `{total: 0, cases: []}` | Graceful empty response, no error |
| Search: auth failure | IAM returns 401 | Tool error response | Error includes `"authentication"`, no crash |
| Search: CSP 500 | Server returns 500 | Tool error response | Error surfaced cleanly to Bob |
| Search: malformed response | Missing `cases` field | Tool error response | Schema validation rejects, error returned |
| Get case: happy path | `{case_id: "TS012345678"}` | Full case object | All required fields present |
| Get case: not found | `{case_id: "TS000000000"}` | 404 error | Error message includes case_id |
| PII scrubber | Case with `customer@example.com` in text | Scrubbed output | No email pattern in output |
| Rate limiter | 4 parallel calls when limit=3 | 3 succeed, 1 queued/rejected | Max 3 concurrent honored |

### Integration Smoke Test

```bash
# test/smoke.sh
# Starts server in fixture mode, sends one tool call, asserts response
FIXTURE_MODE=true node mcp-server/src/index.js &
SERVER_PID=$!
sleep 1

RESULT=$(echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"csp_search_cases","arguments":{"keywords":"OOM error"}}}' \
  | nc -q1 localhost 3000)

echo $RESULT | jq -e '.result.cases | length > 0'
STATUS=$?
kill $SERVER_PID
exit $STATUS
```

### End-to-End Demo Scenarios

| # | Scenario | User Prompt | Expected Bob Response |
|---|----------|-------------|----------------------|
| E1 | **Happy path** | "Search CSP for cases about Kubernetes OOM errors in watsonx.data" | 3–5 case summaries, root cause hypotheses citing case IDs, confidence HIGH, recommended actions |
| E2 | **No results** | "Search CSP for cases about flux capacitor misalignment" | "No relevant cases found. Confidence: INSUFFICIENT. I cannot hypothesize a root cause without evidence." |
| E3 | **Ambiguous product** | "Find support cases about connection timeouts" | Bob asks clarifying question: "Which product?" then proceeds |
| E4 | **Case deep-dive** | "Get full details for case TS012345678" | Full case detail: description, resolution, root cause, environment |
| E5 | **Fixture mode** (demo insurance) | Any of the above with `FIXTURE_MODE=true` | Identical output from canned fixtures; indistinguishable from live |

---

## 11. Hour-by-Hour Execution Schedule

> **Owner** fields are placeholders — assign at standup.  
> **Hard cutoffs** are marked ⛔. Missing them triggers the fallback defined in the Risk Register.

| Time | Block | Tasks | Owner | Deliverable | Hard Cutoff |
|------|-------|-------|-------|-------------|-------------|
| 08:00–08:45 | **Propel recon** | Execute P1–P10 checklist against Propel repo. Authenticate gh to GHE. Document findings. | A | Completed checklist in `docs/` | ⛔ 08:45: If P1–P5 unresolved, pivot to standalone MCP server |
| 08:45–09:15 | **CSP API recon** | Log into CSP UI, open DevTools Network tab, perform 3 searches, capture XHR payloads. Validate or correct §4 assumptions. | B | `docs/csp-api-notes.md` | ⛔ 09:15: If no API found, activate Fallback Tier 1 (scraper) |
| 09:15–09:30 | **Repo init** | Create GitHub repo, push `PLAN.md`, `README.md` skeleton, `package.json`, `.gitignore`, CI workflow stub. | A | Repo URL shared with team | |
| 09:30–10:00 | **Bob: scaffold MCP server** | Use Bob prompt from §9 (Development row 1) to generate MCP server skeleton. Commit. | A | `mcp-server/src/index.ts` committed | |
| 09:30–10:30 | **Bob: auth + client** | Use Bob prompts from §9 (Development rows 2–3) to generate `iam_auth.ts` and `csp_client.ts`. Wire to real endpoints from recon. | B | Auth + client committed | ⛔ 10:30: If auth is blocked, switch to cookie-based auth (Fallback Tier 1) |
| 10:00–10:30 | **Bob: tool handlers** | Wire `csp_search_cases` tool handler to real client. Test manually via `echo | node`. | A | Tool 1 making real calls | |
| 10:30–11:00 | **MVP integration test** | End-to-end: Bob → MCP server → CSP → response. Fix any issues. | A+B | ⛔ **MVP checkpoint**: `csp_search_cases` works from Bob | ⛔ 11:00: If MVP not working, lock fixture mode as demo path |
| 11:00–11:30 | **Bob: generate fixtures** | Use Bob prompt (Testing row 2) to generate `csp_responses.json`. Implement `FIXTURE_MODE` flag in server. | B | Fixture mode working | |
| 11:30–12:00 | **Bob: unit tests** | Use Bob prompt (Testing row 1) to generate `tools.test.ts`. Run `npm test`. Fix failures. | A | Green test suite | |
| 12:00–12:30 | **Lunch break** | | | | |
| 12:30–13:15 | **Tool 2: `csp_get_case`** | Implement + test `csp_get_case` handler. | B | Tool 2 working | |
| 13:15–14:00 | **Skill prompt + analysis step** | Use Bob prompt (Development row 4) to write `analyze.md`. Wire analysis step into skill flow. Test in Bob. | A | Support Intelligence end-to-end (without docs) | |
| 14:00–14:30 | **Bob: skill spec YAML** | Produce `skill/skill-spec.yaml` using §6. Register skill in Bob config. | A | Skill invocable via Bob | |
| 14:30–15:00 | **Connector template** | Use Bob prompt (Development row 5) to generate `connector-template/`. Write `HOWTO.md`. | B | Template committed | |
| 15:00–15:30 | **Bob: documentation sprint** | Run README, guardrails, and runbook prompts from §9. Commit all. | B | `docs/` complete | |
| 15:30–15:45 | **Tool 3: `csp_get_related_docs`** (stretch) | Implement only if Tools 1+2 are solid and time allows. | A | Tool 3 working | |
| 15:45–16:15 | **Demo rehearsal 1** | Run through demo script §13 end-to-end. Note what breaks. Fix critical issues only. | A+B | Issues list | ⛔ 16:15: If live CSP unreliable, switch demo to fixture mode |
| 16:15–16:30 | **Prompt log + Bob feedback** | Use Bob prompts (Documentation rows 6–7) to generate `bob-prompt-log.md` and `bob-feedback.md`. | B | Both deliverable files committed | |
| 16:30–16:45 | **Demo rehearsal 2** | Final run-through. No new features. Fix only show-stoppers. | A+B | Clean demo run | |
| 16:45–17:15 | **Video recording** | Record 5-minute demo per §13 script. First good take wins; no re-editing. | A | `demo.mp4` uploaded | |
| 17:15–17:45 | **Final repo cleanup** | Ensure all files committed, README accurate, CI green, repo public/accessible to judges. | B | Final commit tagged `v0.1.0-hackathon` | |
| 17:45–18:00 | **Submit** | Submit repo URL, video link, prompt log, feedback doc per hackathon instructions. | A+B | Submission confirmed | ⛔ 18:00: Hard deadline |

### MVP vs Stretch Scope

| Feature | MVP | Stretch |
|---------|-----|---------|
| `csp_search_cases` tool | ✅ | |
| Fixture/demo mode | ✅ | |
| Unit tests | ✅ | |
| `csp_get_case` tool | | ✅ |
| `csp_get_related_docs` tool | | ✅ |
| Full Support Intelligence Skill | | ✅ |
| Confidence scoring | | ✅ |
| Connector template + HOWTO | | ✅ |
| Propel marketplace packaging | | ✅ |

---

## 12. Risk Register

| # | Risk | Probability | Impact | Mitigation | Decision Deadline |
|---|------|-------------|--------|------------|-------------------|
| R1 | **No sanctioned CSP API** — CSP only exposes a web UI; no REST API documented or discoverable | HIGH | HIGH | Pre-planned fallbacks: Tier 1 (scrape XHR calls), Tier 2 (proxy service), Tier 3 (fixtures). Fixture mode is built regardless so demo always works. | ⛔ 09:15 |
| R2 | **Auth blocked** — IBM IAM or w3id blocks access from dev environment or service account not provisioned | MEDIUM | HIGH | Two paths: (a) use personal w3id session cookie for demo only, (b) switch entirely to fixture mode for demo. Escalate to CSP team on Slack at 08:00. | ⛔ 10:30 |
| R3 | **Propel pattern harder than expected** — CONTRIBUTING.md is thin, no scaffold, connection format is opaque | MEDIUM | MEDIUM | Fallback: build a standalone MCP server (no Propel packaging). Frame the demo as "we analyzed Propel's pattern and this is how a proper connector should work" — still wins on complexity framing. | ⛔ 08:45 |
| R4 | **MCP registration issues in Bob** — Bob's local config doesn't pick up the new MCP server; tool calls silently fail | MEDIUM | HIGH | Validate MCP server registration with a trivial `echo` tool before wiring CSP. Keep the MCP Inspector open. Have a fallback: call the server directly via curl and show output in terminal during demo. | ⛔ 10:00 (before building on top of it) |
| R5 | **Demo environment failure** — Live CSP unreliable, network issues during judging | HIGH | MEDIUM | Fixture mode (`FIXTURE_MODE=true`) is built by 11:30 and is the primary demo path from 16:15 onward. Practice demo in fixture mode so switch is seamless. | ⛔ 16:15 (declare fixture mode for demo) |

---

## 13. 5-Minute Video Demo Script

> Total runtime: 5:00 | Presenter(s): TBD | Recording tool: Loom or QuickTime

---

**[0:00–0:30] The Problem** *(screen: CSP web UI or a blank search box)*

> "Every IBM support engineer and developer has been here — you're debugging a production issue at 2am, you know someone has seen this before, and the answer is buried in CSP. You're clicking through filters, copy-pasting error messages, reading 10-page case threads. Bob knows everything about your code. But it has no idea what support history exists. That's the gap we're closing today."

---

**[0:30–1:00] The Approach** *(screen: Propel CONTRIBUTING.md or architecture diagram)*

> "We didn't build from scratch. IBM's Bob ecosystem already has a proven integration pattern from the Propel marketplace — Connection, Tool Definitions, Auth, External API. We reverse-engineered that pattern, formalized it as a reusable connector template, and extended Bob's reach into the support domain. This is the Bob that supports you through the full SDLC — including when things go wrong in production."

---

**[1:00–2:00] Live Demo: Search** *(screen: Bob chat window)*

> *Type in Bob:* `"Search CSP for historical cases about Kubernetes OOM errors in watsonx.data"`

> *(While Bob is responding)* "Bob is calling our MCP server, authenticating with CSP, and retrieving matched cases in real time."

> *(Response appears)* "Here's what Bob found: three relevant cases, each cited with a case ID and a direct link. Notice Bob isn't just returning raw data — it's already identifying a pattern: two of these three cases resolved by increasing JVM heap allocation."

---

**[2:00–3:15] Live Demo: Analysis** *(screen: Bob response with structure)*

> *Point to output sections:* "Let's look at what Bob produced. Root cause hypothesis: memory pressure under high-concurrency load — cited from cases TS012345 and TS018967. Recommended action: increase JVM heap to 8GB, reference the exact configuration path. Confidence level: HIGH — three independent cases corroborate this pattern. And every single claim has a citation. Bob can't fabricate a root cause here because we've built guardrails into the skill itself."

> *Scroll to citations:* "These are clickable. Any engineer can verify the source in seconds."

---

**[3:15–4:00] The Reusable Framework** *(screen: `connector-template/` directory or skill-spec.yaml)*

> "But here's what we're really proud of. We didn't just build a CSP connector. We built a connector template. This YAML schema is what defines a skill. Fill in the domain-specific fields and you have a new connector — for any internal system IBM has. The guardrail ruleset is formalized and documented so every connector we build inherits the same agentic best practices: cite sources, report confidence, don't fabricate. We used Bob to design these guardrails, generate the code, write the tests, and produce this documentation — Bob was our co-developer across the entire SDLC."

---

**[4:00–5:00] Close: Bob Across the SDLC** *(screen: `docs/bob-prompt-log.md`)*

> "Here's the prompt log from today. Design, requirements, development, testing, documentation, operations — every phase, Bob was the co-pilot. We didn't use it just for code generation. We used it to reverse-engineer architecture, define guardrails, generate mock data, write runbooks, and draft this demo script. The extension we built is valuable. The methodology we demonstrated is replicable. Thank you."

---

## Open Questions Blocking Implementation

> Ordered by risk. Resolve all of these before 10:00am.

1. **[BLOCKING - R1] Does CSP have a sanctioned REST API?**  
   Who to ask: CSP team in Slack (`#csp-dev` or `#csp-support`). What to find: any API docs, Swagger/OpenAPI spec, or confirmation that only the web UI exists. Deadline: 08:30.

2. **[BLOCKING - R2] What auth method does CSP use?**  
   Action: Log into CSP, open DevTools → Network, filter by XHR. Find the auth request. Is it IBM IAM, w3id SSO, or session cookie? Can a service account be provisioned today? Deadline: 09:00.

3. **[BLOCKING - R3] What concretely is a Propel Connection file?**  
   Action: `gh repo clone github.ibm.com/productivity-platforms/propel-marketplace` after authenticating `gh` to GHE (`gh auth login --hostname github.ibm.com`). Read `CONTRIBUTING.md`. Answer P1–P5. Deadline: 08:45.

4. **[BLOCKING - R4] How does Bob load a new MCP server?**  
   Action: Check Bob's local config file (likely `~/.bob/config.yaml` or similar). Find the `mcpServers` section. Validate that a server added there is callable from Bob's chat. Test with a trivial tool before building on top. Deadline: 09:30.

5. **[MODERATE - R5] Will CSP be accessible from the demo machine on the day?**  
   Action: Confirm network access (VPN required?), confirm demo machine has credentials. If uncertain, commit to fixture-mode demo by 10:00 so fixture data can be captured while access is available. Deadline: 10:00.
