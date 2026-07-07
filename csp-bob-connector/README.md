# CSP Bob Connector

Connect IBM Bob to IBM CSP (Cognitive Support Platform) to search historical support cases, analyze root causes, and get cited recommendations — all without leaving your IDE.

---

## What this is

IBM support engineers and developers spend significant time manually searching CSP for historical cases relevant to the issue they are debugging. This context — what broke before, how it was resolved, what documentation applied — lives in CSP but is invisible inside the tools where engineers actually work: their IDE and AI assistant.

We extend IBM Bob with a **Support Intelligence connector** built on the same layered architecture used by IBM's Propel marketplace (Connection → Tool Definitions → Auth → External API). A developer asks Bob "find CSP cases related to Kubernetes OOM errors in watsonx.data" and receives analyzed results: matched case summaries, root-cause hypotheses, recommended actions, and citations with a stated confidence level. The connector is packaged as a reusable Skill and a documented connector template so any team can wire Bob to any internal support or knowledge system using the same pattern.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        IBM BOB (IDE / Agent)                         │
│                                                                      │
│  User prompt ──► Support Intelligence Skill (system prompt)          │
│                           │                                          │
│         ┌─────────────────┼─────────────────┐                        │
│         ▼                 ▼                 ▼                        │
│  csp_search_cases   csp_get_case   csp_get_related_docs              │
│         └─────────────────┼─────────────────┘                        │
│                           │  MCP Protocol (stdio)                    │
└───────────────────────────┼──────────────────────────────────────────┘
                            │
        ┌───────────────────▼─────────────────────┐
        │         CSP MCP SERVER (Node.js)         │
        │  Tool Handler → Auth Layer → HTTP Client │
        └───────────────────┬─────────────────────┘
                            │  HTTPS
        ┌───────────────────▼─────────────────────┐
        │  IBM API Gateway → CSP (Salesforce)      │
        └─────────────────────────────────────────┘
```

See [`docs/architecture.md`](docs/architecture.md) for the full diagram, component descriptions, workflow steps, and design decisions.

---

## Prerequisites

- **Node.js 20+**
- **IBM App ID credentials** with CSP access (`CSP_CLIENT_ID`, `CSP_CLIENT_SECRET`)
  - Get from 1Password → Vault: "CSP Test Automation" → Item: "API case requests SF_Bot/API_Gateway"
- **IBM Bob IDE** installed and running
- Network access to IBM internal systems (VPN may be required)

---

## Setup

```bash
# 1. Clone and install
git clone https://github.com/your-org/csp-bob-connector.git
cd csp-bob-connector
npm install

# 2. Configure credentials
cp .env.example .env
# Edit .env — add CSP_CLIENT_ID and CSP_CLIENT_SECRET

# 3. Build
npm run build
```

For demo or CI use without live CSP access:
```bash
export FIXTURE_MODE=true
```

---

## Register with Bob

Add the following to Bob's MCP configuration file (`.bob/mcp.json`):

```json
{
  "mcpServers": {
    "csp-connector": {
      "command": "node",
      "args": ["/absolute/path/to/csp-bob-connector/dist/mcp-server/src/index.js"],
      "env": {
        "CSP_CLIENT_ID":     "your-client-id",
        "CSP_CLIENT_SECRET": "your-client-secret",
        "CSP_API_GATEWAY_URL": "https://api-gateway.your-env.codeengine.appdomain.cloud",
        "CSP_SF_CASE_BOT_URL": "https://sf-case-bot.your-env.codeengine.appdomain.cloud"
      }
    }
  }
}
```

For demo mode, add `"FIXTURE_MODE": "true"` to the `env` block.

Restart Bob after editing the config.

---

## Try it

Once registered, type in Bob:

```
Search CSP for historical cases about Kubernetes OOM errors in watsonx.data
```

Expected response:
- Ranked list of matching cases with titles, snippets, and CSP links
- Root cause hypotheses citing specific case IDs
- Recommended actions with source citations
- Confidence level: HIGH / MEDIUM / LOW / INSUFFICIENT

Other example prompts:
```
Find historical cases related to SSL handshake failures in IBM Cloud Object Storage
What do past support cases say about connection pool timeouts in watsonx.governance?
Get full details for case TS012483901
```

---

## Run tests

```bash
npm test
```

The test suite uses `ts-jest` with a fully mocked `CspClient`. No live CSP access required. Tests cover: happy path, empty results, 401 auth failure, 500 server error, and Zod validation errors.

---

## Add a new connector

The `connector-template/` directory contains a fully documented template for connecting Bob to any internal system using the same pattern as this CSP connector.

See [`connector-template/HOWTO.md`](connector-template/HOWTO.md) for step-by-step instructions.

The template takes approximately 2 hours to adapt for a new system. All domain-specific logic is marked with `[CUSTOMIZE]` comments.

---

## Agentic guardrails

This skill enforces 7 agentic best practices (G1–G7) covering: search-before-reasoning, citation requirements, confidence reporting, fabrication prevention, tool call limits, source type tagging, and PII handling.

See [`docs/guardrails.md`](docs/guardrails.md) for the full ruleset and enforcement details. All connectors built from this template must inherit and preserve these guardrails.

---

## License

Apache License 2.0. See [LICENSE](LICENSE).
