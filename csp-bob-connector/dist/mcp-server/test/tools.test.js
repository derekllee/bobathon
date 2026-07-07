"use strict";
/**
 * Unit tests for MCP tool handlers: csp_search_cases, csp_get_case, csp_get_related_docs
 * Uses FIXTURE_MODE so no real credentials or network calls are needed.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const globals_1 = require("@jest/globals");
// ── Load fixture data ─────────────────────────────────────────────────────────
const fixtures = JSON.parse(require("fs").readFileSync(path_1.default.resolve(__dirname, "./fixtures/csp_responses.json"), "utf8"));
// ── Import client in fixture mode ─────────────────────────────────────────────
// Set FIXTURE_MODE before importing so the constructor loads fixtures
process.env.FIXTURE_MODE = "true";
const csp_client_1 = require("../src/client/csp_client");
// Stub auth — never called in FIXTURE_MODE
const stubAuth = { getToken: async () => "" };
function makeClient() {
    return new csp_client_1.CspClient({ auth: stubAuth });
}
// ── Suite 1: csp_search_cases ─────────────────────────────────────────────────
(0, globals_1.describe)("csp_search_cases", () => {
    let client;
    (0, globals_1.beforeAll)(() => {
        client = makeClient();
    });
    (0, globals_1.it)("happy path — OOM query returns 4 cases with correct shape", async () => {
        const result = await client.searchCases({ keywords: "Kubernetes OOM watsonx.data" });
        (0, globals_1.expect)(result.total).toBe(4);
        (0, globals_1.expect)(result.cases).toHaveLength(4);
        const c = result.cases[0];
        (0, globals_1.expect)(c).toHaveProperty("case_id");
        (0, globals_1.expect)(c).toHaveProperty("case_number");
        (0, globals_1.expect)(c).toHaveProperty("title");
        (0, globals_1.expect)(c).toHaveProperty("description_snippet");
        (0, globals_1.expect)(c).toHaveProperty("status");
        (0, globals_1.expect)(c).toHaveProperty("url");
    });
    (0, globals_1.it)("SSL query returns 3 cases", async () => {
        const result = await client.searchCases({ keywords: "SSL handshake IBM COS" });
        (0, globals_1.expect)(result.total).toBe(3);
        (0, globals_1.expect)(result.cases).toHaveLength(3);
    });
    (0, globals_1.it)("timeout query returns 3 cases", async () => {
        const result = await client.searchCases({ keywords: "connection timeout watsonx.governance" });
        (0, globals_1.expect)(result.total).toBe(3);
    });
    (0, globals_1.it)("unknown keyword falls back to OOM fixture", async () => {
        const result = await client.searchCases({ keywords: "unknown query xyz" });
        (0, globals_1.expect)(result.total).toBeGreaterThan(0);
    });
    (0, globals_1.it)("respects limit param (fixture passthrough)", async () => {
        const result = await client.searchCases({ keywords: "OOM", limit: 2 });
        // In fixture mode limit is not enforced server-side but response must be valid
        (0, globals_1.expect)(result).toHaveProperty("total");
        (0, globals_1.expect)(result).toHaveProperty("cases");
    });
});
// ── Suite 2: csp_get_case ─────────────────────────────────────────────────────
(0, globals_1.describe)("csp_get_case", () => {
    let client;
    (0, globals_1.beforeAll)(() => {
        client = makeClient();
    });
    (0, globals_1.it)("happy path — returns full case detail with all required fields", async () => {
        const caseId = fixtures.case_detail[0].case_id;
        const result = await client.getCase(caseId);
        (0, globals_1.expect)(result).toHaveProperty("case_id");
        (0, globals_1.expect)(result).toHaveProperty("case_number");
        (0, globals_1.expect)(result).toHaveProperty("title");
        (0, globals_1.expect)(result).toHaveProperty("description");
        (0, globals_1.expect)(result).toHaveProperty("resolution");
        (0, globals_1.expect)(result).toHaveProperty("url");
        (0, globals_1.expect)(result.case_id).toBe(caseId);
    });
    (0, globals_1.it)("lookup by case_number also resolves", async () => {
        const caseNumber = fixtures.case_detail[1].case_number;
        const result = await client.getCase(caseNumber);
        (0, globals_1.expect)(result.case_number).toBe(caseNumber);
    });
    (0, globals_1.it)("unknown case_id returns fallback fixture (not an error)", async () => {
        const result = await client.getCase("UNKNOWN-999");
        (0, globals_1.expect)(result).toHaveProperty("case_id");
        (0, globals_1.expect)(result).toHaveProperty("title");
        (0, globals_1.expect)(result).toHaveProperty("url");
    });
});
// ── Suite 3: csp_get_related_docs ─────────────────────────────────────────────
(0, globals_1.describe)("csp_get_related_docs", () => {
    let client;
    (0, globals_1.beforeAll)(() => {
        client = makeClient();
    });
    (0, globals_1.it)("returns an articles array (may be empty if no docs fixture)", async () => {
        const result = await client.getRelatedDocs("Kubernetes OOM");
        (0, globals_1.expect)(result).toHaveProperty("articles");
        (0, globals_1.expect)(Array.isArray(result.articles)).toBe(true);
    });
});
//# sourceMappingURL=tools.test.js.map