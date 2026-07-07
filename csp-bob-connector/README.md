# csp-bob-connector

An MCP server that connects IBM Bob to CSP (Cognitive Support Platform), exposing support case search as tools Bob can call.

## Architecture

```
Bob chat → MCP tool call → csp-connector MCP server → IBM API Gateway → Salesforce CSP
```

## Tools

| Tool | Description |
|------|-------------|
| `csp_search_cases` | Search CSP for historical support cases by keyword |
| `csp_get_case` | Get full detail of a case by ID or case number |
| `csp_get_related_docs` | Get related IBM KB articles for keywords or a case |

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set credentials (from 1Password → "CSP Test Automation" vault)
```bash
export CSP_CLIENT_ID=<your_client_id>
export CSP_CLIENT_SECRET=<your_client_secret>
```

### 3. Build
```bash
npm run build
```

### 4. Run (live mode)
```bash
npm start
```

### 5. Run (fixture mode — no credentials needed)
```bash
FIXTURE_MODE=true npm start
```

## Bob Registration

Add to `.bob/mcp.json` in your workspace:

```json
{
  "mcpServers": {
    "csp-connector": {
      "command": "node",
      "args": ["<absolute-path-to>/dist/mcp-server/src/index.js"],
      "env": {
        "CSP_CLIENT_ID": "<your_client_id>",
        "CSP_CLIENT_SECRET": "<your_client_secret>"
      }
    }
  }
}
```

For demo/offline use, add `"FIXTURE_MODE": "true"` to the `env` block.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CSP_CLIENT_ID` | Yes (live) | — | IBM App ID client ID |
| `CSP_CLIENT_SECRET` | Yes (live) | — | IBM App ID client secret |
| `CSP_TOKEN_URL` | No | IBM App ID prod URL | OAuth2 token endpoint |
| `CSP_API_GATEWAY_URL` | No | DEV gateway | API Gateway base URL |
| `CSP_SF_CASE_BOT_URL` | No | DEV case bot | SF Case Bot base URL |
| `FIXTURE_MODE` | No | `false` | Use canned fixture data |

## Testing

```bash
npm test
```

## Auth

Uses IBM App ID OAuth2 (`client_credentials` grant). Tokens are cached for 24h with auto-refresh 5 minutes before expiry. See [`mcp-server/src/auth/iam_auth.ts`](mcp-server/src/auth/iam_auth.ts).
