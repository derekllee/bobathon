# Contributing to CSP Bob Connector

## Overview

This repository is a connector factory. The CSP connector is the first implementation. The `connector-template/` directory contains everything you need to build a new connector — for ServiceNow, PagerDuty, GitHub Issues, an internal ticketing system, or any other data source your team needs inside Bob.

Adding a new connector means you get the same search-and-analysis capability this project provides for CSP, adapted to your domain, in under 2 hours.

---

## 1. The Connector Pattern

Every connector in this repo follows the same four-layer architecture, drawn from the IBM Propel marketplace pattern:

```
Connection (MCP Server)
    └── Tool Definitions   (3 tools: search, get-item, get-related)
            └── Auth Layer         (OAuth2 / API key / session token)
                    └── HTTP Client        (axios, typed responses, fixture mode)
```

Bob calls tools. Tools call the HTTP client. The client authenticates and talks to your system. The skill prompt tells Bob how to use the results. Guardrails G1–G7 are enforced at every layer.

---

## 2. Step-by-Step: Add a New Connector

### Step 1 — Copy the template
```bash
cp -r connector-template/ my-system-connector/
cd my-system-connector/
mv index-template.ts  src/index.ts
mv client-template.ts src/client/my_client.ts
mv auth-template.ts   src/auth/token_manager.ts
```

### Step 2 — Find and fill every `[CUSTOMIZE]` marker
```bash
grep -r "\[CUSTOMIZE" src/
```
Work through them in order: client types → endpoint paths → auth config → tool names → tool descriptions. Every placeholder has an inline comment explaining what to put there.

### Step 3 — Create fixture data
Create `test/fixtures/responses.json` with realistic sample responses from your system. See `csp-bob-connector/mcp-server/test/fixtures/csp_responses.json` for the format. Fixture mode is required — see below.

### Step 4 — Write unit tests
Create `test/tools.test.ts`. Mock your client class with `jest.mock()`. Cover at minimum: happy path, empty results, auth failure (401), server error (500), and missing required parameter. Run `npm test`.

### Step 5 — Register with Bob
Add your server to `.bob/mcp.json` following the pattern in `csp-bob-connector/README.md`. Test with a simple query before building your skill prompt on top.

---

## 3. Required Files for a New Connector

Every connector PR must include:

| File | Description |
|---|---|
| `src/index.ts` | MCP server entry point; registers ≥1 tool |
| `src/client/my_client.ts` | HTTP client with `FIXTURE_MODE` support |
| `src/auth/token_manager.ts` | Auth layer (or a simple API key provider) |
| `test/tools.test.ts` | Unit tests; all 5 minimum cases passing |
| `test/fixtures/responses.json` | Realistic fixture data for demo and CI |
| `skill/skill-spec.yaml` | Filled-in copy of the generic skill schema |
| `skill/prompts/analyze.md` | System prompt adapted for your domain |
| `README.md` | Setup, prerequisites, example prompts |

---

## 4. Agentic Guardrails

All connectors must inherit guardrails G1–G7. These are non-negotiable because they protect the quality of Bob's responses and prevent the agent from fabricating information.

| Guardrail | What it requires | How to customize |
|---|---|---|
| **G1** Search first | Call your search tool before reasoning | Update tool name in system prompt; keep the rule |
| **G2** Cite every claim | `[YOURSYSTEM:id] "quoted evidence"` format | Replace `CSP` with your system abbreviation |
| **G3** Confidence always | Output confidence_level + rationale | Adjust rubric thresholds (e.g. HIGH requires ≥2 cases if your data is sparse) |
| **G4** No fabrication | Only hypothesize from retrieved data | Keep as-is; no domain customization needed |
| **G5** Bound tool calls | Max 3 detail fetches, max 2 tool types | Adjust numbers based on your system's rate limits |
| **G6** Tag source type | Distinguish record types in citations | Add your source types (e.g. `INCIDENT`, `KB_ARTICLE`, `RUNBOOK`) |
| **G7** No PII | Summarize; don't echo customer data | Add your system's sensitive field names to the system prompt |

You may add domain-specific rules after G7 (e.g. G8: only surface cases from the last 2 years). Do not remove or soften G1–G7.

---

## 5. Testing Requirements

Unit tests are mandatory. The test suite must pass in CI before merge.

**Minimum test cases:**
1. Happy path: tool returns data, all required fields present
2. Empty results: `{ total: 0, results: [] }` — no error thrown
3. Auth failure: `MyApiError(401)` → `isError: true`, text contains "authentication"
4. Server error: `MyApiError(500)` → `isError: true`
5. Missing required param: Zod validation error → `isError: true`

Run tests with: `npm test`

All tests must use mocked clients. No live external API calls in unit tests.

---

## 6. Demo Mode (FIXTURE_MODE)

Every connector must support `FIXTURE_MODE=true`. When set, the HTTP client reads from `test/fixtures/responses.json` instead of making real API calls.

**Why this is required:**
- Demo reliability: live systems are unreliable during presentations
- CI safety: no credentials needed in CI environment
- Development speed: build and test the full skill flow without API access

Verify fixture mode works before submitting a PR:
```bash
FIXTURE_MODE=true node dist/index.js
```
Then send a tool call via stdin and confirm you get the fixture response.

---

## 7. Submitting a Pull Request

**Branch naming:** `connector/<system-name>` (e.g. `connector/servicenow`, `connector/pagerduty`)

**PR description must include:**
- What system you connected and why
- The 3 example Bob prompts that demonstrate the skill
- Confirmation that `npm test` passes
- Screenshot or log showing `FIXTURE_MODE=true` working
- Any deviations from the standard template and the reason

**PR checklist:**
- [ ] All `[CUSTOMIZE]` markers replaced
- [ ] All 8 required files present
- [ ] `npm test` passes with no skipped tests
- [ ] `FIXTURE_MODE=true` produces sensible output
- [ ] Guardrails G1–G7 preserved in system prompt and skill spec
- [ ] README includes setup steps and example prompts

Questions? Open an issue or ask in the team channel.
