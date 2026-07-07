# 🔍 Team Member B — CSP API Recon, Auth & Fixtures

> Paste this entire file into a fresh Bob window at standup.  
> Your job: discover how CSP's API actually works, implement auth, generate fixtures, write Tool 2, build the connector template.  
> **Critical output by 09:15:** real CSP endpoint URL + auth method handed to Team Member A.

---

## Your Context (read once, then start)

We are building a Bob IDE extension that connects IBM Bob to CSP (Cognitive Support Platform). Your role is the investigative and infrastructure layer: you figure out what CSP's API actually looks like (since we only have assumptions), implement the auth layer, generate realistic fixture data for demo reliability, and implement the `csp_get_case` tool in the afternoon.

Team Member A owns the MCP server scaffold and integration.  
Team Member C owns docs, skill spec, and demo.

The most important thing you do today is the morning recon. **Everything else blocks on your findings.**

---

## Your Schedule

| Time | Task | Hard Cutoff |
|------|------|-------------|
| 08:00–08:45 | CSP API recon: network trace, endpoint discovery | ⛔ 09:15: hand findings to A |
| 08:45–09:15 | Auth method validation; service account or cookie fallback | ⛔ 09:15: hand auth details to A |
| 09:15–09:45 | Document findings in `docs/csp-api-notes.md`; write `iam_auth.ts` | |
| 09:45–10:30 | `iam_auth.ts` complete + wired into server (with A) | ⛔ 10:30: auth blocked → cookie fallback |
| 10:30–11:00 | Support A on MVP integration test | |
| 11:00–11:30 | Generate fixture data (real captures + Bob-generated) | |
| 11:30–12:00 | Write `tools.test.ts` unit tests (hand to A to run) | |
| 12:00–12:30 | Lunch | |
| 12:30–13:15 | Implement `csp_get_case` handler (stub already in server) | |
| 13:15–14:30 | Build `connector-template/` + `HOWTO.md` | |
| 14:30–15:00 | Write `docs/guardrails.md` full document | |
| 15:00–15:30 | Write `docs/runbook.md` + `README.md` sections | |
| 15:30–16:15 | Support C on demo prep; write `docs/bob-prompt-log.md` | |
| 16:15–16:30 | Write `docs/bob-feedback.md` | |
| 16:30–17:45 | Demo rehearsals + final repo cleanup | |

---

## Step 1 — CSP API Recon (08:00–08:45)

**This is the highest-risk task of the day. Do it first, do it thoroughly.**

### 1a. Check for a published API

Search these locations (5 minutes each):
1. IBM internal API catalog: `https://developer.ibm.com` or internal API Hub — search "CSP" or "Cognitive Support Platform"
2. Slack: search `#csp-dev`, `#csp-support`, `#csp-api` for any API documentation links
3. IBM Confluence: search "CSP REST API" or "CSP developer guide"
4. The CSP UI itself: look for a "Developer" or "API" link in the footer or settings

If you find an API spec (Swagger/OpenAPI), ask Bob:

> **Bob prompt:**
> ```
> Here is the CSP API OpenAPI spec: [paste spec]
>
> Extract and summarize:
> 1. The search endpoint: URL, method, required params, response shape
> 2. The get-case endpoint: URL, required params, response shape
> 3. The auth method: what header/token format is required?
> 4. Any rate limits documented?
>
> Output as a structured markdown document I can save as docs/csp-api-notes.md
> ```

### 1b. Network trace (if no published API)

Log into CSP web UI. Open DevTools (F12) → Network tab → filter by "Fetch/XHR". Perform these 3 actions and capture each network request:
1. Search for "Kubernetes OOM"
2. Click into one search result
3. Search for "connection timeout watsonx"

For each captured request, note:
- Full URL (copy from DevTools)
- HTTP method (GET/POST)
- Request headers (especially `Authorization` or `Cookie`)
- Request body (for POSTs)
- Response body (first 200 chars)

Ask Bob:

> **Bob prompt:**
> ```
> I captured these network requests from the CSP web UI:
> [paste each request as: URL | Method | Headers | Body | Response snippet]
>
> Infer the REST API contract:
> 1. What is the search endpoint signature (URL pattern, method, params)?
> 2. What is the get-case endpoint signature?
> 3. What auth mechanism is being used (IAM Bearer, session cookie, other)?
> 4. What is the response schema for search results?
> 5. Flag any ambiguities or inconsistencies.
>
> Output as docs/csp-api-notes.md with ASSUMPTION tags on anything inferred vs confirmed.
> ```

Save output to `docs/csp-api-notes.md`. **Hand the key findings (endpoint URL + auth method) to A by 09:15.**

### Decision gate at 09:15:

| Finding | Action |
|---------|--------|
| Sanctioned REST API found | Use it directly; document in `csp-api-notes.md` |
| No API, but clean XHR calls found | Use scraper approach (replay XHR calls with session cookie) |
| No clean API at all | Tell A to activate FIXTURE_MODE now; capture real data manually while you still have browser access |

---

## Step 2 — Auth Method (08:45–09:15, runs in parallel with late recon)

### Option A: IBM IAM (if CSP uses IAM)

> **Bob prompt:**
> ```
> Write a TypeScript class IamTokenManager that:
> - Fetches an IAM access token from process.env.IAM_TOKEN_URL
>   using a client_credentials grant with process.env.IAM_API_KEY
> - Caches the token in memory
> - Proactively refreshes it 60 seconds before expiry (check token.expiration field)
> - Exposes a single async method: getToken(): Promise<string>
> - Throws an AuthError with a clear message on failure
> - Uses axios for the HTTP call
> - No external dependencies beyond axios
> ```

Save to `mcp-server/src/auth/iam_auth.ts`.

### Option B: Session cookie fallback (if CSP uses w3id SSO)

> **Bob prompt:**
> ```
> Write a TypeScript function extractSessionCookie() that:
> - Reads a cookie string from process.env.CSP_SESSION_COOKIE
> - Validates it is non-empty and looks like a valid cookie value
> - Returns an object { cookieName: string, cookieValue: string }
>   where cookieName defaults to "LtpaToken2" unless process.env.CSP_COOKIE_NAME is set
> - Logs a warning if the cookie looks like it may be expired (>8 hours old by checking env var CSP_COOKIE_SET_AT)
> ```

Save to `mcp-server/src/auth/session_auth.ts`.

### Test auth immediately:

```bash
# Option A — IAM
IAM_API_KEY=your_key IAM_TOKEN_URL=https://iam.cloud.ibm.com/identity/token \
  node -e "import('./dist/auth/iam_auth.js').then(m => m.default.getToken().then(console.log))"

# Option B — Cookie (for demo: grab cookie from DevTools Application tab)
CSP_SESSION_COOKIE="LtpaToken2=abc123..." node -e "..."
```

---

## Step 3 — Document Findings (09:15–09:45)

Write `docs/csp-api-notes.md` with the real validated endpoints. Use this structure:

```markdown
# CSP API Notes

## Status: [VALIDATED / ASSUMED / FALLBACK-COOKIE]

## Auth Method
- Type: [IAM Bearer / Session Cookie / Other]
- Env vars required: [list]

## Search Endpoint
- URL: [actual URL found]
- Method: [GET/POST]
- Request: [shape]
- Response: [shape]
- Confirmed: [yes/from network trace/assumed]

## Get Case Endpoint
- URL: [actual URL found]
- ...

## Rate Limits
- [any observed or documented]

## Known Issues / Gotchas
- [anything weird found in recon]
```

Tell A the key facts: URL and auth method. That's all they need to proceed.

---

## Step 4 — Generate Fixture Data (11:00–11:30)

This is demo insurance. Even if live CSP works, fixtures make the demo bulletproof.

### 4a. Capture real data (best)

If you have CSP access, perform 2-3 real searches on topics like:
- "Kubernetes OOM watsonx.data"
- "SSL handshake failure IBM Cloud"
- "timeout connection pool watsonx"

Copy the raw API responses (from DevTools Network tab) into `mcp-server/test/fixtures/csp_responses.json`.

### 4b. Bob-generated fixtures (backup)

> **Bob prompt:**
> ```
> Generate realistic mock CSP support case data for the following search queries.
> Each case must have: case_id (format: TSxxxxxxxxx, 9 digits), title, description_snippet
> (2-3 sentences), product, severity ("1"|"2"|"3"|"4"), status ("open"|"closed"),
> resolution_summary (2-3 sentences describing what fixed it), url
> (format: https://csp.ibm.com/cases/{case_id}).
>
> Query 1: "Kubernetes OOM errors watsonx.data"
> → 4 cases, all closed, all related to JVM heap exhaustion under concurrent load,
>   all resolved by increasing heap or adjusting GC settings
>
> Query 2: "SSL handshake failure IBM Cloud Object Storage"
> → 3 cases, 2 closed 1 open, related to certificate chain issues and TLS version mismatches
>
> Query 3: "connection pool timeout watsonx.governance"
> → 3 cases, all closed, related to connection pool exhaustion under high concurrency
>
> Output as JSON:
> {
>   "search_OOM_watsonx": { "total": 4, "cases": [...] },
>   "search_SSL_COS": { "total": 3, "cases": [...] },
>   "search_timeout_governance": { "total": 3, "cases": [...] }
> }
>
> Also generate 2 full case detail objects (for csp_get_case) using case_ids from above.
> Add them under key "case_detail".
> ```

Save output to `mcp-server/test/fixtures/csp_responses.json`. Hand this to A by 11:30.

---

## Step 5 — Unit Tests (11:30–12:00)

> **Bob prompt:**
> ```
> Write Jest unit tests for these MCP tool handlers.
> The handlers are in mcp-server/src/index.ts and use a CspClient class.
> Mock CspClient with jest.mock.
>
> Test suite 1 — csp_search_cases:
> 1. Happy path: mock returns fixture data → assert { total, cases } shape
> 2. Empty results: mock returns { total: 0, cases: [] } → no error thrown
> 3. 401 from CspClient → isError: true, message contains "authentication"
> 4. 500 from CspClient → isError: true
> 5. Missing keywords param → Zod validation error → isError: true
>
> Test suite 2 — csp_get_case:
> 6. Happy path: returns full case object with all required fields
> 7. 404 from CspClient → isError: true, message contains the case_id
>
> Test suite 3 — auth (IamTokenManager):
> 8. Successful token fetch → returns non-empty string
> 9. IAM returns 401 → throws AuthError
> 10. Token is cached: second call does not make a second HTTP request
>
> Use ts-jest. Import fixture data from ./fixtures/csp_responses.json.
> ```

Save to `mcp-server/test/tools.test.ts`. Hand to A to run `npm test`.

---

## Step 6 — `csp_get_case` Handler (12:30–13:15)

The stub is already in A's `mcp-server/src/index.ts`. You just need to implement the real handler body. Ask A for the current stub code, then:

> **Bob prompt:**
> ```
> Here is the stub for the csp_get_case tool handler: [paste stub]
> Here is the CspClient.getCase() method signature: [paste from csp_client.ts]
>
> Complete the handler so it:
> 1. Validates input with Zod (case_id: string, required, non-empty)
> 2. Calls cspClient.getCase(case_id)
> 3. Returns the full case object formatted as MCP content
> 4. Handles errors: 404 → "Case {case_id} not found", other → "CSP error: {message}"
> 5. Respects FIXTURE_MODE (already in CspClient, just wire up)
> ```

---

## Step 7 — Connector Template (13:15–14:30)

This is a major judging differentiator. Once the CSP connector works, strip it to a template.

> **Bob prompt:**
> ```
> I have a working CSP MCP connector. Here are the key files:
> [paste mcp-server/src/index.ts]
> [paste mcp-server/src/client/csp_client.ts]
> [paste mcp-server/src/auth/iam_auth.ts]
>
> Create a reusable connector template by:
> 1. Replace all CSP-specific logic with [CUSTOMIZE: description] placeholders
> 2. Keep the structural pattern intact (MCP server setup, tool registration, auth layer, HTTP client)
> 3. Output 3 files:
>    - connector-template/tool-template.ts  (generic tool handler)
>    - connector-template/client-template.ts (generic HTTP client)
>    - connector-template/index-template.ts  (generic server entry point)
> 4. Write connector-template/HOWTO.md that explains step-by-step how a new team
>    uses the template to connect Bob to a different internal system.
>    Include: what to customize, required env vars, how to test, how to register with Bob.
> ```

---

## Step 8 — Documentation Sprint (14:30–16:15)

### `docs/guardrails.md`

> **Bob prompt:**
> ```
> Expand this guardrail ruleset into a full document:
>
> G1: Search before reasoning — always retrieve data before forming hypotheses
> G2: Cite every claim — every factual statement must cite a case_id or article_id
> G3: Report confidence always — HIGH/MEDIUM/LOW/INSUFFICIENT + rationale
> G4: Never fabricate root causes — hypotheses must be supported by retrieved evidence
> G5: Bound tool calls — max 3 parallel calls, max 2 tool types per query
> G6: Distinguish case vs docs data — tag source_type: CSP_CASE or KB_ARTICLE
> G7: Respect data sensitivity — summarize PII, never repeat raw customer details
>
> For each rule, write:
> - Motivation (why this matters for a support intelligence agent)
> - Enforcement mechanism (system prompt / output schema / MCP middleware)
> - Example of the rule being triggered (what the agent does vs doesn't do)
> - How a future connector author customizes this rule for their domain
> ```

### `docs/runbook.md`

> **Bob prompt:**
> ```
> Write an operations runbook for the CSP Bob connector MCP server.
> Audience: an on-call engineer who did not build this system.
>
> Sections:
> 1. Starting the server (commands, env vars required)
> 2. Health check (how to verify it's running and registered in Bob)
> 3. Common errors and remediation:
>    - "authentication failed" → how to refresh IAM token or session cookie
>    - "429 Too Many Requests" → backoff procedure
>    - "500 from CSP" → check CSP status page, fallback to fixture mode
>    - "tool not found in Bob" → MCP registration troubleshooting
> 4. Updating credentials (IAM API key rotation, cookie refresh)
> 5. Switching to fixture mode for demos or outages
> 6. Adding new fixture data
> ```

### `docs/bob-prompt-log.md`

Compile all Bob prompts used throughout the day — this is a required hackathon deliverable.

> **Bob prompt:**
> ```
> I'm going to paste all the prompts I used with Bob today. Compile them into
> a structured log with these columns:
> Phase | Prompt (abbreviated to first sentence) | What Bob output | Quality rating (1-5) | Notes
>
> Prompts used: [paste each prompt from your task doc, in order]
>
> After the table, write a 3-sentence summary of patterns observed:
> what prompt styles worked best for code generation vs documentation vs architecture tasks.
> ```

---

## Key Files You Own

| File | Status |
|------|--------|
| `docs/csp-api-notes.md` | You write (from recon) |
| `mcp-server/src/auth/iam_auth.ts` | You write |
| `mcp-server/src/auth/session_auth.ts` | You write (fallback) |
| `mcp-server/test/tools.test.ts` | You write (Bob-generated) |
| `mcp-server/test/fixtures/csp_responses.json` | You write |
| `connector-template/` (all files) | You write |
| `docs/guardrails.md` | You write |
| `docs/runbook.md` | You write |
| `docs/bob-prompt-log.md` | You compile |

---

## Handoffs

| What | Direction | When |
|------|-----------|------|
| CSP endpoint URL + auth method | You → A | ⛔ By 09:15 |
| `iam_auth.ts` or `session_auth.ts` | You → A | By 09:45 |
| `csp_responses.json` fixture file | You → A + C | By 11:30 |
| `tools.test.ts` (hand to A to run) | You → A | By 12:00 |
| `connector-template/` (for C's demo) | You → C | By 14:30 |
| `docs/guardrails.md` (for C's docs) | You → C | By 15:00 |
| `docs/bob-prompt-log.md` | You → everyone | By 16:30 |
