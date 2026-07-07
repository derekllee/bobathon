# CSP API Notes

## Status: ✅ FULLY VALIDATED — IBM API Gateway (production-grade OAuth2)

> Source: CSP Dev Playbook — https://w3.ibm.com/support/csp-dev-playbook/
> Contact: graham_daly@us.ibm.com

---

## Architecture Discovery

CSP exposes a **purpose-built IBM API Gateway** (running on IBM Cloud Code Engine) that
sits in front of Salesforce. This is the sanctioned programmatic interface — do NOT use
the raw Salesforce session token approach. The gateway handles all Salesforce auth internally.

```
MCP Server → IBM API Gateway (Code Engine) → Salesforce (ibmsf)
                      ↑
              IBM App ID OAuth2
              (client_credentials)
```

---

## Platform

| Property | Value |
|----------|-------|
| Underlying platform | Salesforce Lightning (Force.com) |
| Programmatic interface | IBM API Gateway (IBM Cloud Code Engine) |
| Auth system | IBM App ID (us-south) — OAuth2 client_credentials |
| Developer reference | https://w3.ibm.com/support/csp-dev-playbook/ |
| Credentials location | 1Password → Vault: "CSP Test Automation" → Item: "API case requests SF_Bot/API_Gateway" |

---

## Auth Method ✅ CONFIRMED

### Token endpoint
```
POST https://us-south.appid.cloud.ibm.com/oauth/v4/cdbe3fa4-35a9-45b9-9efa-15b1a50cdc11/token

Authorization: Basic {base64(client_id:client_secret)}   ← from 1Password
Content-Type: application/x-www-form-urlencoded

Body:
  grant_type=client_credentials

Response:
  { "access_token": "eyJ...", "token_type": "Bearer", "expires_in": 86400 }
```

**Token lifetime: 24 hours** (as documented in Dev Playbook)

### Required env vars
```bash
CSP_CLIENT_ID=<from 1Password>
CSP_CLIENT_SECRET=<from 1Password>
CSP_TOKEN_URL=https://us-south.appid.cloud.ibm.com/oauth/v4/cdbe3fa4-35a9-45b9-9efa-15b1a50cdc11/token
CSP_API_GATEWAY_URL=https://api-gateway-prod.sl2g9er7sj9.us-south.codeengine.appdomain.cloud
CSP_SF_CASE_BOT_URL=https://sf-case-bot-prod.sl2g9er7sj9.us-south.codeengine.appdomain.cloud
```

---

## Environment URLs

| Env | API Gateway | SF Case Bot |
|-----|-------------|-------------|
| DEV | https://api-gateway-dev.rdzma4q6ch8.us-south.codeengine.appdomain.cloud | https://sf-case-bot-dev.rdzma4q6ch8.us-south.codeengine.appdomain.cloud |
| INT | https://api-gateway-int.s2n8ca1w3ow.us-south.codeengine.appdomain.cloud | https://sf-case-bot-int.s2n8ca1w3ow.us-south.codeengine.appdomain.cloud |
| STG | https://api-gateway-stg.sb2v3e5vm5u.us-south.codeengine.appdomain.cloud | https://sf-case-bot-stg.sb2v3e5vm5u.us-south.codeengine.appdomain.cloud |
| PROD | https://api-gateway-prod.sl2g9er7sj9.us-south.codeengine.appdomain.cloud | https://sf-case-bot-prod.sl2g9er7sj9.us-south.codeengine.appdomain.cloud |

**Use DEV or INT for hackathon testing. Use PROD only for demo.**

---

## Confirmed Endpoints

### 1. Search / Get Case by ID ✅
```
GET {API_GATEWAY}/api/v1/automate
  (with action=sf_case_get — ASSUMPTION: search by keyword not yet confirmed, see §Notes)

OR direct Salesforce sobject (confirmed in Dev Playbook):
GET https://ibmsf--test2.sandbox.my.salesforce.com/services/data/v62.0/sobjects/Case/{id}
```

### 2. Create Case ✅ (confirmed, not needed for our use case but proves API works)
```
POST {API_GATEWAY}/api/v1/automate
Authorization: Bearer {access_token}
Content-Type: application/json

Body:
{
  "action": "sf_case_create",
  "version": 1,
  "input": { ... }
}

Response: { "success": true, "response": { "created_case": { "case_number": "TS011848201", "case_id": "500Dy000009CZc1IAG" } } }
```

### 3. Get Case Details (SF Case Bot) ✅
```
POST {SF_CASE_BOT}/api/v1/case_feed
Authorization: Bearer {access_token}
Content-Type: application/json

Body:
{
  "case": { "id": "{case_id}" },
  "update_data": {
    "Description": "...",
    "Subject": "...",
    "Resolution_Description__c": "...",
    "CaseNumber": "...",
    "Keyword__c": "..."
  }
}

Key confirmed fields on Case object:
- CaseNumber (e.g. "TS011848201")
- Subject
- Description
- Translated_Description__c
- Resolution_Description__c   ← THIS IS OUR resolution field
- Keyword__c                  ← keywords/tags
- Comments
```

### 4. Account Lookup ✅
```
POST {API_GATEWAY}/api/v1/automate
Body: { "action": "sf_account_lookup", "version": "1", "query": { "by": "contact_email", "value": "..." } }
```

---

## Search Strategy (ASSUMPTION — validate with CSP team)

The API Gateway's `automate` endpoint uses an `action` pattern. We have confirmed:
- `sf_case_create`
- `sf_case_close`
- `sf_case_update`
- `sf_account_lookup`

**ASSUMPTION[search-1]:** A `sf_case_search` or `sf_case_list` action likely exists.
**Validation:** Email graham_daly@us.ibm.com or check the full Dev Playbook for search actions.

**Fallback if no search action:** Use direct Salesforce SOQL via the gateway or query endpoint:
```
POST {API_GATEWAY}/api/v1/automate
Body: { "action": "sf_case_search", "version": 1, "query": { "keywords": "OOM watsonx" } }
```

---

## Confirmed Case Object Fields

From `SF_case_bot` response:
| Field | Type | Notes |
|-------|------|-------|
| `CaseNumber` | string | e.g. `TS011848201` — this is the user-visible ID |
| `case_id` (Salesforce ID) | string | e.g. `500Dy000009CZc1IAG` — internal SF ID |
| `Subject` | string | Case title |
| `Description` | string | Full case description |
| `Translated_Description__c` | string | Translated description |
| `Resolution_Description__c` | string | ✅ Resolution text — key field for our analysis |
| `Keyword__c` | string | Keywords/tags |
| `Comments` | string | Case comments/feed |

---

## Known Issues / Gotchas

1. **No search endpoint confirmed yet** — the automate endpoint uses named actions; a search/list action must be validated with the CSP team or Dev Playbook
2. **Credentials in 1Password** — get them now; without them the token endpoint cannot be tested
3. **Token lifetime 24h** — much better than Salesforce session tokens; `IamTokenManager` handles auto-refresh
4. **Use DEV env for testing** — do not hammer PROD during development
5. **case_id vs CaseNumber** — Salesforce internal ID (`500Dy...`) vs human-readable TS number (`TS011848201`); our tools should accept both and return both

---

## Validation TODO

- [ ] Get credentials from 1Password (CSP Test Automation vault)
- [ ] Run token endpoint — confirm 200 + access_token
- [ ] Call API gateway with access_token — confirm 200
- [ ] Find/confirm search action name in Dev Playbook (email graham_daly@us.ibm.com if needed)
- [ ] Fetch a real case by CaseNumber — confirm Resolution_Description__c field exists
