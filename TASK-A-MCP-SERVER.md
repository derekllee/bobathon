# 🔧 Team Member A — MCP Server & Integration Lead

> Paste this entire file into a fresh Bob window at standup.  
> Your job: build the MCP server, wire it to CSP, own the MVP checkpoint.  
> **MVP definition:** `csp_search_cases` callable from Bob with real (or fixture) cited results by 11:00.

---

## Your Context (read once, then start)

We are building a Bob IDE extension that connects IBM Bob to CSP (Cognitive Support Platform — IBM's internal support case system). The core deliverable is an MCP server that exposes CSP search as tools Bob can call.

Architecture:
```
Bob chat → MCP tool call → [YOUR MCP SERVER] → CSP API → structured response
```

The MCP server registers 3 tools. You own all of them:
- `csp_search_cases` — **MVP, must work by 11:00**
- `csp_get_case` — stretch, afternoon
- `csp_get_related_docs` — stretch, afternoon

Team Member B owns auth research + CSP API recon (they will hand you the real endpoint and token by 09:15).  
Team Member C owns docs, skill spec, and demo.

---

## Your Schedule

| Time | Task | Hard Cutoff |
|------|------|-------------|
| 08:00–08:45 | Propel recon (P1–P10 checklist) + GHE auth | ⛔ 08:45: if P1–P5 blocked, pivot to standalone MCP server |
| 08:45–09:15 | Repo init: create GitHub repo, push skeleton files | |
| 09:15–09:30 | Verify Bob MCP registration works (trivial echo tool) | ⛔ 09:30: must confirm before building on top |
| 09:30–10:00 | Bob prompt → scaffold MCP server with 3 stub tools | |
| 10:00–10:30 | Wire `csp_search_cases` to real client (from B's recon) | |
| 10:30–11:00 | MVP integration test: Bob → server → CSP → response | ⛔ 11:00: MVP checkpoint |
| 11:00–11:30 | Implement `FIXTURE_MODE` flag + canned fixture data | |
| 11:30–12:00 | Unit tests (use Bob prompt below) | |
| 12:00–12:30 | Lunch | |
| 12:30–13:15 | Implement `csp_get_case` tool | |
| 13:15–14:00 | Wire analysis step into skill flow; test in Bob | |
| 14:00–14:30 | Register skill in Bob config | |
| 14:30–15:45 | Stretch: `csp_get_related_docs`; support C on demo | |
| 15:45–16:15 | Demo rehearsal 1 with C | |
| 16:30–16:45 | Demo rehearsal 2 | |
| 16:45–17:15 | Record video with C | |
| 17:15–17:45 | Final repo cleanup, tag `v0.1.0-hackathon`, CI green | |

---

## Step 1 — Propel Recon (08:00–08:45)

Authenticate to IBM GHE and clone Propel:

```bash
gh auth login --hostname github.ibm.com
gh repo clone github.ibm.com/productivity-platforms/propel-marketplace
```

Then ask Bob:

> **Bob prompt:**
> ```
> I've cloned the Propel marketplace repo. Here is the CONTRIBUTING.md:
> [paste CONTRIBUTING.md contents]
>
> Answer these questions as a numbered list:
> 1. What is a Connection concretely — what files does it require?
> 2. What is a Skill concretely — workflow YAML, prompt chain, or custom mode?
> 3. How are auth/secrets handled?
> 4. How is an extension registered in the marketplace?
> 5. What does packaging require (build command, output format)?
> 6. What MCP transport do existing connectors use (stdio/SSE/HTTP)?
> 7. What language/runtime are connectors written in?
> 8. Is there an existing connector template or scaffold to copy?
> ```

Capture Bob's answers in `docs/propel-recon.md`. If P1–P5 are unanswered by 08:45, proceed as a standalone MCP server (skip Propel packaging — still score points for the analysis).

---

## Step 2 — Repo Init (08:45–09:15)

```bash
mkdir csp-bob-connector && cd csp-bob-connector
git init
gh repo create csp-bob-connector --public --source=. --push
```

Create these files now (stubs are fine, content comes later):
```
README.md
PLAN.md          ← copy from team shared doc
package.json     ← see below
.gitignore
.github/workflows/ci.yml
mcp-server/src/  ← empty dir
docs/            ← empty dir
```

`package.json` starter:
```json
{
  "name": "csp-bob-connector",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "axios": "^1.6.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  }
}
```

---

## Step 3 — Validate Bob MCP Registration (09:15–09:30)

**This must work before you build anything else.**

Ask Bob:

> **Bob prompt:**
> ```
> How do I register a new MCP server in Bob's local configuration?
> What is the config file path and format? Show me the exact snippet
> to add a server called "csp-connector" that runs via stdio transport
> using the command: node /path/to/dist/index.js
> ```

Then create the world's simplest MCP server to confirm registration works:

```typescript
// mcp-server/src/echo-test.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({ name: "echo-test", version: "0.0.1" }, {
  capabilities: { tools: {} }
});

server.setRequestHandler("tools/list", async () => ({
  tools: [{ name: "echo", description: "Echoes input", inputSchema: {
    type: "object", properties: { message: { type: "string" } }, required: ["message"]
  }}]
}));

server.setRequestHandler("tools/call", async (req: any) => ({
  content: [{ type: "text", text: `Echo: ${req.params.arguments.message}` }]
}));

const transport = new StdioServerTransport();
await server.connect(transport);
```

Register it in Bob, type "echo hello world" in Bob chat, confirm it responds. Only proceed once this works. **⛔ Hard cutoff 09:30.**

---

## Step 4 — Scaffold Real MCP Server (09:30–10:00)

Use this Bob prompt:

> **Bob prompt:**
> ```
> Generate a TypeScript MCP server using @modelcontextprotocol/sdk.
> Requirements:
> - Use stdio transport
> - Register exactly 3 tools: csp_search_cases, csp_get_case, csp_get_related_docs
> - Each tool handler should call a method on a CspClient instance (injected via constructor)
> - Tool descriptions, input schemas, and output schemas are:
>
> Tool 1 — csp_search_cases:
>   description: "Search IBM CSP for historical support cases. Always call this before root cause analysis."
>   input: { keywords: string (required), product?: string, severity?: "1"|"2"|"3"|"4"|"any", status?: "open"|"closed"|"all", limit?: integer 1-20 default 10 }
>   output: { total: integer, cases: Array<{ case_id, title, description_snippet, product, severity, status, resolution_summary, url }> }
>
> Tool 2 — csp_get_case:
>   description: "Get full detail of a CSP case by ID. Use after csp_search_cases."
>   input: { case_id: string (required) }
>   output: { case_id, title, description, resolution, root_cause, environment: object, components: string[], url }
>
> Tool 3 — csp_get_related_docs:
>   description: "Get related IBM KB articles for keywords or a case."
>   input: { keywords: string (required), case_id?: string, limit?: integer default 5 max 10 }
>   output: { articles: Array<{ article_id, title, snippet, url }> }
>
> Use Zod for input validation. Each handler should catch errors and return
> { content: [{ type: "text", text: "Error: ..." }], isError: true } on failure.
> CspClient is imported from "./client/csp_client.js" — stub it for now.
> ```

Save output to `mcp-server/src/index.ts`. Commit.

---

## Step 5 — Wire `csp_search_cases` to CSP (10:00–10:30)

By now, Team Member B should have handed you the real CSP endpoint and auth details from their recon. If not yet, use the assumed endpoint and switch later.

Use this Bob prompt:

> **Bob prompt:**
> ```
> Write a TypeScript class CspClient with these methods:
>   - searchCases(params: { keywords: string, product?: string, severity?: string, status?: string, limit?: number }): Promise<CspSearchResponse>
>   - getCase(caseId: string): Promise<CspCase>
>   - getRelatedDocs(keywords: string, caseId?: string, limit?: number): Promise<CspDocsResponse>
>
> Implementation details:
> - Use axios for HTTP
> - Constructor takes: baseUrl: string, tokenProvider: () => Promise<string>
> - Set Authorization: Bearer {token} header on every request
> - Retry once on 429 (wait 1s) and once on 503
> - Throw a CspApiError with { statusCode, message } on non-2xx responses
> - If env var FIXTURE_MODE=true, load responses from ./fixtures/csp_responses.json
>   instead of making real HTTP calls
>
> CSP search endpoint (ASSUMPTION — confirm with team):
>   POST https://csp.ibm.com/api/v1/cases/search
>   body: { query, filters: { product, severity, status }, limit, offset }
>
> CSP get case endpoint (ASSUMPTION):
>   GET https://csp.ibm.com/api/v1/cases/{caseId}
>
> Export all TypeScript types.
> ```

Save to `mcp-server/src/client/csp_client.ts`. Replace the assumed endpoints with B's real findings as soon as they're available.

---

## Step 6 — MVP Integration Test (10:30–11:00)

Test the full chain manually:

```bash
# Build
npm run build

# Test with echo (confirm server starts)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js

# Test csp_search_cases
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"csp_search_cases","arguments":{"keywords":"Kubernetes OOM watsonx.data"}}}' | node dist/index.js
```

Then test from Bob:
> Type in Bob: `"Search CSP for Kubernetes OOM errors in watsonx.data"`

If Bob returns case results → **MVP achieved. ✅ Checkpoint at 11:00.**

If live CSP is unreliable → activate `FIXTURE_MODE=true` in your server launch command. The fixture path is the demo path from here on.

---

## Step 7 — Fixture Mode (11:00–11:30)

Ask Team Member B for the fixture data they captured from the real CSP UI. If not available, use Bob:

> **Bob prompt:**
> ```
> Generate realistic mock CSP API responses for a search query
> "Kubernetes OOM errors watsonx.data". Create 4 cases, each with:
> case_id (format TSxxxxxxxxx), title, description_snippet, product="watsonx.data",
> severity="2", status="closed", resolution_summary, url.
> Make the cases internally consistent: they should all relate to
> JVM heap exhaustion under concurrent query load.
> Output as a JSON object: { "search_OOM_watsonx": { total: 4, cases: [...] } }
> ```

Save to `mcp-server/test/fixtures/csp_responses.json`.

Implement the `FIXTURE_MODE` check in `CspClient`:
```typescript
if (process.env.FIXTURE_MODE === 'true') {
  const fixtures = JSON.parse(fs.readFileSync('./test/fixtures/csp_responses.json', 'utf8'));
  return fixtures['search_OOM_watsonx']; // or match by keywords
}
```

---

## Step 8 — Unit Tests (11:30–12:00)

> **Bob prompt:**
> ```
> Write Jest unit tests for the csp_search_cases tool handler in my MCP server.
> Mock the CspClient class. Test these cases:
> 1. Happy path: CspClient.searchCases returns 3 cases → tool returns { total: 3, cases: [...] }
> 2. Empty results: returns { total: 0, cases: [] }
> 3. Auth failure: CspClient throws CspApiError(401) → tool returns isError:true, message includes "authentication"
> 4. Server error: CspClient throws CspApiError(500) → tool returns isError:true
> 5. Invalid input: keywords missing → Zod throws → tool returns isError:true
>
> Also test csp_get_case:
> 6. Happy path: returns full case object
> 7. Not found: CspApiError(404) → isError:true, message includes case_id
>
> Use ts-jest. Mock with jest.mock('./client/csp_client.js').
> Assert output schema compliance (all required fields present).
> ```

Run `npm test`. Fix any failures. Commit with green CI.

---

## Afternoon: Tool 2, Skill Wiring, Stretch

### `csp_get_case` (12:30–13:15)
The stub is already in `index.ts`. Wire it to `CspClient.getCase()`. Test via Bob:
> `"Get full details for case TS012345678"`

### Wire analysis step (13:15–14:00)
Team Member C will produce `skill/prompts/analyze.md`. Once they do:

> **Bob prompt:**
> ```
> I have an MCP server with csp_search_cases and csp_get_case tools registered in Bob.
> I also have this system prompt in skill/prompts/analyze.md: [paste content from C]
>
> Write the Bob custom mode configuration (YAML) that:
> 1. Sets this system prompt as the mode's roleDefinition
> 2. Names the mode "Support Intelligence"
> 3. Shows example invocation prompts
> Show me exactly where to put this file in Bob's config directory.
> ```

### Register in Bob config (14:00–14:30)
Apply C's skill spec + your mode config. Test the full flow in Bob.

### Stretch: `csp_get_related_docs` (15:30–15:45)
Only if Tools 1+2 are solid. Wire to `CspClient.getRelatedDocs()`.

---

## Demo Rehearsal Checklist

Before 15:45, confirm:
- [ ] Bob can be asked "Search CSP for Kubernetes OOM errors in watsonx.data" and returns cited cases
- [ ] Fixture mode produces identical-looking output (`FIXTURE_MODE=true`)  
- [ ] `npm test` passes
- [ ] Repo is committed and pushable
- [ ] You can narrate the architecture diagram from memory (30 seconds)

---

## Key Files You Own

| File | Status |
|------|--------|
| `mcp-server/src/index.ts` | You write |
| `mcp-server/src/client/csp_client.ts` | You write (with B's endpoint data) |
| `mcp-server/test/tools.test.ts` | You write (Bob-generated) |
| `mcp-server/test/fixtures/csp_responses.json` | You write (Bob-generated) |
| `docs/propel-recon.md` | You write (from Propel recon) |
| `package.json`, `tsconfig.json` | You own |
| `.github/workflows/ci.yml` | You write |

---

## Handoffs

| What | Direction | When |
|------|-----------|------|
| Real CSP endpoint + auth details | B → you | By 09:15 |
| `skill/prompts/analyze.md` | C → you | By 13:15 |
| Repo URL | You → everyone | By 09:30 |
| Fixture JSON | You → C (for demo) | By 11:30 |
| Green `npm test` screenshot | You → C (for prompt log) | By 12:00 |
