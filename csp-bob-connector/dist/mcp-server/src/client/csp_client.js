"use strict";
/**
 * CSP HTTP Client
 *
 * Wraps the IBM API Gateway and SF Case Bot endpoints that sit in front of
 * IBM's Salesforce-based CSP (Cognitive Support Platform).
 *
 * Auth: IBM App ID OAuth2 tokens via IamTokenManager.
 * If FIXTURE_MODE=true, returns canned responses from test/fixtures/csp_responses.json.
 *
 * API Gateway actions used:
 *   sf_case_search  — search cases by keyword (ASSUMPTION: confirm action name)
 *   sf_case_get     — get case by CaseNumber or Salesforce ID (ASSUMPTION)
 *
 * Confirmed endpoints (from CSP Dev Playbook):
 *   POST {API_GATEWAY}/api/v1/automate  — case actions
 *   POST {SF_CASE_BOT}/api/v1/case_feed — case detail / update
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CspClient = exports.CspApiError = void 0;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Resolve fixture path relative to the project root (csp-bob-connector/) so it works
// both when compiled (node runs from project root) and under ts-jest.
const FIXTURE_PATH = path_1.default.resolve(process.cwd(), "mcp-server/test/fixtures/csp_responses.json");
class CspApiError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "CspApiError";
    }
}
exports.CspApiError = CspApiError;
class CspClient {
    auth;
    apiGatewayUrl;
    sfCaseBotUrl;
    http;
    fixtures = null;
    constructor(config) {
        this.auth = config.auth;
        this.apiGatewayUrl =
            config.apiGatewayUrl ??
                process.env.CSP_API_GATEWAY_URL ??
                "https://api-gateway-dev.rdzma4q6ch8.us-south.codeengine.appdomain.cloud";
        this.sfCaseBotUrl =
            config.sfCaseBotUrl ??
                process.env.CSP_SF_CASE_BOT_URL ??
                "https://sf-case-bot-dev.rdzma4q6ch8.us-south.codeengine.appdomain.cloud";
        this.http = axios_1.default.create({ timeout: 15_000 });
        if (process.env.FIXTURE_MODE === "true") {
            this.fixtures = JSON.parse(fs_1.default.readFileSync(FIXTURE_PATH, "utf8"));
            console.log("[CspClient] FIXTURE_MODE enabled — using canned responses.");
        }
    }
    // ─── Search Cases ──────────────────────────────────────────────────────────
    async searchCases(params) {
        if (this.fixtures) {
            return this.fixtureSearch(params.keywords);
        }
        const token = await this.auth.getToken();
        // ASSUMPTION[search-action]: action name "sf_case_search" — validate with CSP team.
        // If this returns 400/404, try "sf_case_list" or contact graham_daly@us.ibm.com.
        const body = {
            action: "sf_case_search",
            version: 1,
            query: {
                keywords: params.keywords,
                ...(params.product && { product: params.product }),
                ...(params.status && params.status !== "all" && { status: params.status }),
                limit: params.limit ?? 10,
            },
        };
        const raw = await this.post(`${this.apiGatewayUrl}/api/v1/automate`, body, token);
        return this.normalizeSearchResponse(raw);
    }
    // ─── Get Case Detail ───────────────────────────────────────────────────────
    async getCase(caseId) {
        if (this.fixtures) {
            return this.fixtureGetCase(caseId);
        }
        const token = await this.auth.getToken();
        // Try SF Case Bot first (has Resolution_Description__c field)
        const body = {
            case: { id: caseId },
            update_data: {
            // empty update_data fetches current values
            },
        };
        const raw = await this.post(`${this.sfCaseBotUrl}/api/v1/case_feed`, body, token);
        return this.normalizeCaseDetail(raw, caseId);
    }
    // ─── Get Related Docs ──────────────────────────────────────────────────────
    async getRelatedDocs(keywords, caseId, limit = 5) {
        if (this.fixtures) {
            return this.fixtureDocs(keywords);
        }
        // ASSUMPTION[docs-action]: docs/KB search action name unknown.
        // Fallback: return empty until confirmed.
        console.warn("[CspClient] getRelatedDocs: action name unconfirmed, returning empty.");
        return { articles: [] };
    }
    // ─── HTTP helpers ──────────────────────────────────────────────────────────
    async post(url, body, token) {
        try {
            const res = await this.http.post(url, body, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            return res.data;
        }
        catch (err) {
            const status = err.response?.status ?? 0;
            const msg = err.response?.data?.message ??
                err.response?.data?.error ??
                err.message;
            if (status === 401)
                throw new CspApiError(401, `Authentication failed: ${msg}`);
            if (status === 404)
                throw new CspApiError(404, `Not found: ${msg}`);
            if (status === 429) {
                // Retry once after 1s
                await new Promise((r) => setTimeout(r, 1000));
                return this.post(url, body, token);
            }
            throw new CspApiError(status, `CSP API error (${status}): ${msg}`);
        }
    }
    // ─── Response normalizers ──────────────────────────────────────────────────
    normalizeSearchResponse(raw) {
        // ASSUMPTION: response shape based on sf_case_create pattern.
        // Actual search response shape may differ — update after first real call.
        const cases = (raw?.response?.cases ?? raw?.response ?? []).map((c) => ({
            case_id: c.case_id ?? c.id ?? c.Id ?? "",
            case_number: c.case_number ?? c.CaseNumber ?? c.number ?? "",
            title: c.subject ?? c.Subject ?? c.title ?? "",
            description_snippet: (c.description ?? c.Description ?? "").substring(0, 300),
            product: c.product ?? c.Product__c ?? undefined,
            severity: c.priority ?? c.Priority ?? undefined,
            status: c.status ?? c.Status ?? "unknown",
            resolution_summary: (c.resolution ?? c.Resolution_Description__c ?? "").substring(0, 300),
            url: `https://ibmsf.lightning.force.com/lightning/r/Case/${c.case_id ?? c.Id}/view`,
        }));
        return { total: cases.length, cases };
    }
    normalizeCaseDetail(raw, caseId) {
        const c = raw?.request?.update_data ?? raw?.response ?? raw ?? {};
        return {
            case_id: caseId,
            case_number: c.CaseNumber ?? "",
            title: c.Subject ?? "",
            description: c.Description ?? "",
            resolution: c.Resolution_Description__c ?? "",
            root_cause: c.Root_Cause__c ?? undefined,
            keywords: c.Keyword__c ?? undefined,
            url: `https://ibmsf.lightning.force.com/lightning/r/Case/${caseId}/view`,
        };
    }
    // ─── Fixture helpers ───────────────────────────────────────────────────────
    fixtureSearch(keywords) {
        const key = keywords.toLowerCase();
        if (key.includes("oom") || key.includes("memory")) {
            return this.fixtures["search_OOM_watsonx"] ?? { total: 0, cases: [] };
        }
        if (key.includes("ssl") || key.includes("certificate") || key.includes("tls")) {
            return this.fixtures["search_SSL_COS"] ?? { total: 0, cases: [] };
        }
        if (key.includes("timeout") || key.includes("connection")) {
            return this.fixtures["search_timeout_governance"] ?? { total: 0, cases: [] };
        }
        return this.fixtures["search_OOM_watsonx"] ?? { total: 0, cases: [] };
    }
    fixtureGetCase(caseId) {
        const cases = this.fixtures["case_detail"] ?? [];
        return (cases.find((c) => c.case_id === caseId || c.case_number === caseId) ??
            cases[0] ?? {
            case_id: caseId,
            case_number: caseId,
            title: "Fixture case",
            description: "Fixture description",
            resolution: "Fixture resolution",
            url: `https://ibmsf.lightning.force.com/lightning/r/Case/${caseId}/view`,
        });
    }
    fixtureDocs(keywords) {
        return this.fixtures["docs"] ?? { articles: [] };
    }
}
exports.CspClient = CspClient;
//# sourceMappingURL=csp_client.js.map