# CSP Bob Connector — Operations Runbook

> **Audience:** On-call engineer who did not build this system.  
> **Purpose:** Start, verify, troubleshoot, and maintain the MCP server that connects IBM Bob to CSP.

---

## 1. Starting the Server

### Required environment variables

| Variable | Required | Description |
|---|---|---|
| `CSP_BASE_URL` | Yes (live mode) | Base URL of the CSP API, e.g. `https://csp.ibm.com/api/v2` |
| `IAM_API_KEY` | Yes (live mode) | IBM Cloud API key with CSP read access |
| `IAM_TOKEN_URL` | No | Defaults to `https://iam.cloud.ibm.com/identity/token` |
| `FIXTURE_MODE` | No | Set to `true` to serve fixture data instead of calling CSP |
| `PORT` | No | HTTP port for the server (default: 3000, if HTTP transport used) |

### Start in live mode

```bash
cd csp-bob-connector
npm run build                         # compile TypeScript → dist/
CSP_BASE_URL=https://csp.ibm.com/api/v2 \
  IAM_API_KEY=your_api_key \
  node dist/mcp-server/src/index.js
```

### Start in fixture mode (demo / outage fallback)

```bash
cd csp-bob-connector
npm run build
FIXTURE_MODE=true node dist/mcp-server/src/index.js
```

The server communicates over **stdio** (JSON-RPC 2.0). It does not bind a TCP port unless you add an HTTP transport wrapper.

---

## 2. Health Check

### Verify the server responds

Send a `tools/list` JSON-RPC request over stdin:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | FIXTURE_MODE=true node dist/mcp-server/src/index.js
```

Expected response includes all three tools:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      { "name": "csp_search_cases", ... },
      { "name": "csp_get_case", ... },
      { "name": "csp_get_related_docs", ... }
    ]
  }
}
```

### Verify a tool call works

```bash
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"csp_search_cases","arguments":{"keywords":"OOM watsonx"}}}' \
  | FIXTURE_MODE=true node dist/mcp-server/src/index.js
```

Expected: a JSON-RPC response with `result.content[0].text` containing case data.

### Verify Bob registration

In Bob chat, type: `/support-search test`

Expected: Bob invokes `csp_search_cases` and returns a structured response.  
If no response: see Section 5 (tool not found in Bob).

---

## 3. Common Errors and Remediation

### 3a. "authentication failed" / 401 Unauthorized

**Cause:** The IAM access token has expired or the API key is invalid.

**Remediation:**
1. Verify the API key is still active in IBM Cloud IAM console.
2. If using session cookie fallback (`CSP_SESSION_COOKIE`), the cookie may have expired (8-hour TTL). Log into CSP web UI and extract a fresh `LtpaToken2` cookie from DevTools → Application → Cookies.
3. Restart the server with the refreshed credential — the `IamTokenManager` will fetch a new token on the next call.
4. As an immediate mitigation, switch to fixture mode:
   ```bash
   FIXTURE_MODE=true node dist/mcp-server/src/index.js
   ```

---

### 3b. "429 Too Many Requests"

**Cause:** The CSP API rate limit has been hit (typically 60 requests/minute per API key).

**Remediation:**
1. The server does not implement automatic retry. Requests will fail with an error surfaced to Bob.
2. Wait 60 seconds before retrying.
3. If this recurs under normal load, request a higher rate-limit tier from the CSP team.
4. For demos, switch to fixture mode to eliminate all live API calls:
   ```bash
   FIXTURE_MODE=true node dist/mcp-server/src/index.js
   ```

---

### 3c. "500 from CSP" / CSP Internal Server Error

**Cause:** CSP API is experiencing an outage or degraded service.

**Remediation:**
1. Check the CSP status page: `https://csp.ibm.com/status` (or your internal status board).
2. If CSP is down, activate fixture mode immediately — it serves pre-recorded realistic data:
   ```bash
   FIXTURE_MODE=true node dist/mcp-server/src/index.js
   ```
3. File an incident with the CSP team if the outage persists beyond 15 minutes.
4. Fixture mode does not require any credentials or network access.

---

### 3d. "tool not found in Bob" / Bob doesn't invoke the tools

**Cause:** The MCP server is not registered in Bob's config, or the registration is stale.

**Remediation:**
1. Check `.bob/mcp.json` in your workspace root. It should contain:
   ```json
   {
     "mcpServers": {
       "csp-connector": {
         "command": "node",
         "args": ["csp-bob-connector/dist/mcp-server/src/index.js"],
         "env": {
           "FIXTURE_MODE": "true"
         }
       }
     }
   }
   ```
2. Ensure the `dist/` directory exists (`npm run build` inside `csp-bob-connector/`).
3. Reload the Bob window (Cmd+Shift+P → "Reload Window" in VS Code).
4. Check Bob's MCP log panel for connection errors.
5. Test the server directly via stdin (see Section 2) to confirm it starts without errors.

---

## 4. Updating Credentials

### Rotating the IAM API key

1. Generate a new API key in IBM Cloud IAM → Service IDs → your service ID.
2. Update `IAM_API_KEY` in your environment or secrets manager.
3. Restart the MCP server — it will fetch a new token on first use. No code changes needed.
4. Revoke the old API key in IBM Cloud IAM after confirming the new key works.

### Refreshing a session cookie (w3id / LtpaToken2 fallback)

1. Log into CSP web UI in Chrome/Firefox.
2. Open DevTools → Application → Cookies → find `LtpaToken2`.
3. Copy the cookie value.
4. Set `CSP_SESSION_COOKIE=LtpaToken2=<value>` and `CSP_COOKIE_SET_AT=<unix-epoch-seconds>` in the environment.
5. Restart the server. The `session_auth.ts` helper will warn if the cookie is older than 8 hours.

---

## 5. Switching to Fixture Mode

Fixture mode serves pre-recorded data from `mcp-server/test/fixtures/csp_responses.json`. No network calls are made. Use it for demos, development, or during CSP outages.

**To activate:**
```bash
FIXTURE_MODE=true node dist/mcp-server/src/index.js
```

**In Bob config** (`.bob/mcp.json`), set the env block:
```json
"env": { "FIXTURE_MODE": "true" }
```

Then reload the Bob window.

**To deactivate:** remove `FIXTURE_MODE` from the env and restart.

---

## 6. Adding New Fixture Data

Fixture data lives in [`mcp-server/test/fixtures/csp_responses.json`](../mcp-server/test/fixtures/csp_responses.json).

The top-level keys are:
- `search_OOM_watsonx` — search fixture for OOM/watsonx queries
- `search_SSL_COS` — search fixture for SSL/COS queries
- `search_timeout_governance` — search fixture for timeout/governance queries
- `case_detail` — array of full case objects returned by `csp_get_case`

### To add a new search fixture:

1. Add a new top-level key (e.g., `search_auth_failure`).
2. Follow the existing structure: `{ "total": N, "cases": [...] }`.
3. Each case requires: `case_id`, `case_number`, `title`, `description_snippet`, `product`, `severity`, `status`, `resolution_summary`, `url`.
4. Update `csp_client.ts` — the fixture router selects a response based on keyword matching. Add your keywords to the fixture dispatch map:

   ```typescript
   // In csp_client.ts fixture block:
   if (keywords.includes("auth") || keywords.includes("authentication")) {
     return fixtures.search_auth_failure;
   }
   ```

5. Add a new case detail entry to the `case_detail` array (needed if `csp_get_case` should return it).
6. Run `npm test` to confirm no tests break.

---

*Last updated: Bobathon 2025 — Team B*
