# Bob MCP Connector Template — HOWTO

Connect any internal IBM system to Bob in under 2 hours by following these steps.

---

## What you're building

```
Bob chat  →  MCP tool call  →  [Your MCP Server]  →  Your Internal API  →  structured response
```

Bob treats each tool as a function it can call when answering a user.  
Your server translates those calls into real HTTP requests against your system.

---

## Files in this template

| File | What it is |
|---|---|
| `index-template.ts` | MCP server entry point — registers tools, handles routing |
| `client-template.ts` | HTTP client — talks to your API, normalises responses |
| `auth-template.ts` | OAuth2 token manager — caches tokens, handles 401 retry |

---

## Step 1 — Copy the template

```bash
cp -r connector-template/ my-system-connector/
cd my-system-connector/
```

Rename each file to drop the `-template` suffix:

```bash
mv index-template.ts  src/index.ts
mv client-template.ts src/client/my_client.ts
mv auth-template.ts   src/auth/token_manager.ts
```

---

## Step 2 — Install dependencies

```bash
npm init -y
npm install @modelcontextprotocol/sdk zod axios
npm install -D typescript ts-jest @types/node jest
```

Add this `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

Add this `jest.config.js`:

```js
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
};
```

---

## Step 3 — Search for every `[CUSTOMIZE]` comment

Every placeholder is marked with `[CUSTOMIZE: description]`. Find them all at once:

```bash
grep -r "\[CUSTOMIZE" src/
```

Work through them in this order:

### 3a — `src/client/my_client.ts`

1. **Rename the class** — replace `MyClient` with e.g. `ServiceNowClient`.
2. **Rename the error class** — replace `MyApiError` → `ServiceNowApiError`.
3. **Update the types** — replace `SearchResult`, `ItemDetail`, `RelatedItem` with the
   actual field names your API returns.
4. **Update `normalizeSearch()`** — map `raw?.results` to the real array key in your
   API's response (e.g. `raw?.incidents`, `raw?.records`, `raw?.hits`).
5. **Update `normalizeItem()`** — map `raw?.title` etc. to real field names.
6. **Update endpoint paths** in `search()`, `getItem()`, `getRelated()` — replace
   `/search`, `/items/:id`, `/related` with your actual paths.
7. **Choose GET vs POST** — `getItem()` uses `this.get()` by default. Switch to
   `this.post()` if your API requires a POST body to fetch a record.
8. **Update fixture key names** in `fixtureSearch()` / `fixtureItem()` to match the
   keys you'll use in `test/fixtures/responses.json`.

### 3b — `src/auth/token_manager.ts`

1. **Set `DEFAULT_TOKEN_URL`** to your identity provider's token endpoint.
2. **Rename env vars** — replace `MY_CLIENT_ID` / `MY_CLIENT_SECRET` / `MY_TOKEN_URL`
   with names that reflect your system (e.g. `SN_CLIENT_ID`).
3. **Check the grant type** — `client_credentials` works for most IBM/cloud systems.
   If you're using an API key, skip this file entirely (see the comment at the bottom).
4. **Update the error message** to tell future users where to find the credentials.

### 3c — `src/index.ts`

1. **Rename tool names** (e.g. `my_search` → `snow_search_incidents`). These are what
   Bob sees — use `snake_case` and keep them descriptive.
2. **Update tool descriptions** — these appear in Bob's tool list. One clear sentence
   that says when to call the tool.
3. **Update `inputSchema` properties** to match your Zod schemas.
4. **Wire the constructor** — pass your real base URL env var and the token provider:
   ```typescript
   const auth   = createTokenManager();
   const client = new ServiceNowClient(
     process.env["SN_BASE_URL"] ?? "https://your-instance.service-now.com",
     () => auth.getToken(),
   );
   ```
5. **Rename handler branches** to match your tool names.

---

## Step 4 — Create fixture data

Fixture mode lets you demo and test without hitting the real API.

Create `test/fixtures/responses.json` with keys matching what your client's
`fixtureSearch()` / `fixtureItem()` methods look for:

```json
{
  "search_default": {
    "total": 2,
    "results": [
      {
        "id": "INC0012345",
        "title": "Example incident title",
        "snippet": "Two or three sentence description of the problem.",
        "status": "closed",
        "url": "https://your-instance.service-now.com/nav_to.do?uri=incident.do?sys_id=abc123"
      }
    ]
  },
  "item_detail": [
    {
      "id": "INC0012345",
      "title": "Example incident title",
      "description": "Full description text.",
      "resolution": "How it was fixed.",
      "url": "https://your-instance.service-now.com/nav_to.do?uri=incident.do?sys_id=abc123"
    }
  ]
}
```

Add a branch for each keyword pattern you want to demo (see `fixtureSearch()` in
`client-template.ts` for the routing pattern).

---

## Step 5 — Write tests

Create `test/tools.test.ts`. The minimum test surface for any connector:

```typescript
jest.mock("../src/client/my_client.js");
import { MyClient, MyApiError } from "../src/client/my_client.js";

// 1. Happy path — search returns results
// 2. Empty results — { total: 0, results: [] } → no error
// 3. Auth failure — MyApiError(401) → isError: true, text includes "authentication"
// 4. Server error — MyApiError(500) → isError: true
// 5. Missing required param — Zod parse failure → isError: true
```

Run: `npm test`

---

## Step 6 — Register in Bob

Add this to Bob's MCP config file (`.bob/mcp.json` or equivalent):

```json
{
  "mcpServers": {
    "my-system-connector": {
      "command": "node",
      "args": ["/absolute/path/to/my-system-connector/dist/index.js"],
      "env": {
        "MY_CLIENT_ID":     "your-client-id",
        "MY_CLIENT_SECRET": "your-client-secret",
        "MY_API_BASE_URL":  "https://your-api-host.example.com/api/v1"
      }
    }
  }
}
```

Build first: `npm run build`

Restart Bob, then verify in a chat window:

> "Search [your system] for [something you know exists]"

Bob should call your tool and return structured results.

---

## Step 7 — Enable fixture mode for demos

Add `"FIXTURE_MODE": "true"` to the `env` block in `.bob/mcp.json`.  
The client will read from `test/fixtures/responses.json` instead of hitting the real API.  
Remove it (or set to `"false"`) for live use.

---

## Common problems

| Symptom | Likely cause | Fix |
|---|---|---|
| Bob doesn't see the tool | Server failed to start | Run `node dist/index.js` manually; check for startup errors |
| `AuthError: ... must be set` | Missing env vars | Add `MY_CLIENT_ID` / `MY_CLIENT_SECRET` to the `env` block |
| Tool returns `isError: true` with a 401 | Token is wrong or expired | Verify credentials; call `auth.clearCache()` and retry |
| Response fields are all empty strings | Normalizer field names don't match API | `console.log(raw)` in `normalizeSearch()` to see the real shape |
| Tests fail with `Cannot find module` | ESM import paths | Ensure `.js` extension in all imports even for `.ts` source files |
| Zod parse error on valid input | Schema mismatch | Check `required[]` in `inputSchema` matches Zod `.min(1)` constraints |

---

## What the CSP connector (the original) does differently

This template is a direct generalisation of the CSP connector built for the
Bobathon hackathon. If you want to see a real implementation to compare against:

| Template file | CSP original |
|---|---|
| `client-template.ts` | `csp-bob-connector/mcp-server/src/client/csp_client.ts` |
| `auth-template.ts` | `csp-bob-connector/mcp-server/src/auth/iam_auth.ts` |
| `index-template.ts` | `csp-bob-connector/mcp-server/src/index.ts` |

Key differences in CSP:
- Uses two base URLs (API Gateway + SF Case Bot) instead of one — split into two
  `post()` calls with different paths.
- Response normalizer handles multiple Salesforce field name variants (`Subject` /
  `subject` / `title`) because the SF schema is inconsistent.
- Fixture routing matches on OOM / SSL / timeout keywords to serve different fixture
  slices for the demo.
