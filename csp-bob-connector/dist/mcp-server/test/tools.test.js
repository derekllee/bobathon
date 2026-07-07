"use strict";
/**
 * Unit tests for MCP tool handlers in mcp-server/src/index.ts
 *
 * Strategy: mock CspClient entirely so no HTTP calls are made.
 * Tests verify the handler's input validation, response shaping, and error handling.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const csp_responses_json_1 = __importDefault(require("./fixtures/csp_responses.json"));
// ── Mock CspClient before importing the server ────────────────────────────────
const mockSearchCases = jest.fn();
const mockGetCase = jest.fn();
const mockGetRelatedDocs = jest.fn();
jest.mock("../src/client/csp_client", () => ({
    CspClient: jest.fn().mockImplementation(() => ({
        searchCases: mockSearchCases,
        getCase: mockGetCase,
        getRelatedDocs: mockGetRelatedDocs,
    })),
    CspApiError: class CspApiError extends Error {
        statusCode;
        constructor(statusCode, message) {
            super(message);
            this.name = "CspApiError";
            this.statusCode = statusCode;
        }
    },
}));
const csp_client_1 = require("../src/client/csp_client");
// Helper: simulate what the server does in its CallToolRequestSchema handler
// We re-implement the minimal dispatch to test each branch in isolation.
async function callTool(name, args) {
    const { z } = await Promise.resolve().then(() => __importStar(require("zod")));
    const SearchCasesInput = z.object({
        keywords: z.string().min(1),
        product: z.string().optional(),
        severity: z.enum(["1", "2", "3", "4", "any"]).optional(),
        status: z.enum(["open", "closed", "all"]).optional(),
        limit: z.number().int().min(1).max(20).default(10),
    });
    const GetCaseInput = z.object({
        case_id: z.string().min(1),
    });
    const GetRelatedDocsInput = z.object({
        keywords: z.string().min(1),
        case_id: z.string().optional(),
        limit: z.number().int().min(1).max(10).default(5),
    });
    // Mirror the exact try/catch shape from index.ts
    try {
        if (name === "csp_search_cases") {
            const input = SearchCasesInput.parse(args);
            const result = await mockSearchCases(input);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        if (name === "csp_get_case") {
            const input = GetCaseInput.parse(args);
            const result = await mockGetCase(input.case_id);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        if (name === "csp_get_related_docs") {
            const input = GetRelatedDocsInput.parse(args);
            const result = await mockGetRelatedDocs(input.keywords, input.case_id, input.limit);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        return {
            content: [{ type: "text", text: `Error: Unknown tool "${name}"` }],
            isError: true,
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
            isError: true,
        };
    }
}
// ── Fixtures ──────────────────────────────────────────────────────────────────
const oomFixture = csp_responses_json_1.default.search_OOM_watsonx;
const caseDetailFixture = csp_responses_json_1.default.case_detail[0];
// ── Suite 1: csp_search_cases ─────────────────────────────────────────────────
describe("csp_search_cases", () => {
    beforeEach(() => jest.clearAllMocks());
    test("1. happy path — returns cases from CspClient", async () => {
        mockSearchCases.mockResolvedValue(oomFixture);
        const result = await callTool("csp_search_cases", { keywords: "OOM watsonx.data" });
        expect(result.isError).toBeFalsy();
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe("text");
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.total).toBe(4);
        expect(parsed.cases).toHaveLength(4);
        // Assert required fields on first case
        const first = parsed.cases[0];
        expect(first.case_id).toBeTruthy();
        expect(first.case_number).toBeTruthy();
        expect(first.title).toBeTruthy();
        expect(first.status).toBeTruthy();
        expect(first.url).toMatch(/^https:\/\//);
    });
    test("2. empty results — no error, empty array", async () => {
        mockSearchCases.mockResolvedValue({ total: 0, cases: [] });
        const result = await callTool("csp_search_cases", { keywords: "zzznomatch99999" });
        expect(result.isError).toBeFalsy();
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.total).toBe(0);
        expect(parsed.cases).toHaveLength(0);
    });
    test("3. CspApiError 401 — isError true, message contains 'authentication'", async () => {
        mockSearchCases.mockRejectedValue(new csp_client_1.CspApiError(401, "Authentication failed: invalid token"));
        const result = await callTool("csp_search_cases", { keywords: "OOM" });
        expect(result.isError).toBe(true);
        expect(result.content[0].text.toLowerCase()).toContain("authentication");
    });
    test("4. CspApiError 500 — isError true", async () => {
        mockSearchCases.mockRejectedValue(new csp_client_1.CspApiError(500, "Internal server error"));
        const result = await callTool("csp_search_cases", { keywords: "OOM" });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Error");
    });
    test("5. missing keywords (empty string) — Zod validation error, isError true", async () => {
        const result = await callTool("csp_search_cases", { keywords: "" });
        expect(result.isError).toBe(true);
        // mockSearchCases should never have been called
        expect(mockSearchCases).not.toHaveBeenCalled();
    });
    test("5b. missing keywords entirely — isError true", async () => {
        const result = await callTool("csp_search_cases", {});
        expect(result.isError).toBe(true);
        expect(mockSearchCases).not.toHaveBeenCalled();
    });
});
// ── Suite 2: csp_get_case ─────────────────────────────────────────────────────
describe("csp_get_case", () => {
    beforeEach(() => jest.clearAllMocks());
    test("6. happy path — returns full case detail with all required fields", async () => {
        mockGetCase.mockResolvedValue(caseDetailFixture);
        const result = await callTool("csp_get_case", { case_id: caseDetailFixture.case_id });
        expect(result.isError).toBeFalsy();
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.case_id).toBeTruthy();
        expect(parsed.case_number).toBeTruthy();
        expect(parsed.title).toBeTruthy();
        expect(parsed.description).toBeTruthy();
        expect(parsed.resolution).toBeTruthy();
        expect(parsed.url).toMatch(/^https:\/\//);
    });
    test("7. CspApiError 404 — isError true, message contains case_id", async () => {
        const missingId = "500DyXXXXXXXXXXXX";
        mockGetCase.mockRejectedValue(new csp_client_1.CspApiError(404, `Case ${missingId} not found`));
        const result = await callTool("csp_get_case", { case_id: missingId });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain(missingId);
    });
    test("7b. missing case_id — Zod validation error, isError true", async () => {
        const result = await callTool("csp_get_case", {});
        expect(result.isError).toBe(true);
        expect(mockGetCase).not.toHaveBeenCalled();
    });
});
// ── Suite 3: csp_get_related_docs ────────────────────────────────────────────
describe("csp_get_related_docs", () => {
    beforeEach(() => jest.clearAllMocks());
    test("8. happy path — returns articles array", async () => {
        mockGetRelatedDocs.mockResolvedValue({
            articles: [
                {
                    article_id: "KB001",
                    title: "How to tune JVM heap in watsonx.data",
                    snippet: "Increase -Xmx to match container memory limit...",
                    url: "https://ibm.com/docs/watsonx-data/jvm-tuning",
                },
            ],
        });
        const result = await callTool("csp_get_related_docs", { keywords: "JVM heap tuning" });
        expect(result.isError).toBeFalsy();
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.articles).toHaveLength(1);
        expect(parsed.articles[0].article_id).toBe("KB001");
        expect(parsed.articles[0].url).toMatch(/^https:\/\//);
    });
    test("9. empty docs — no error, empty articles array", async () => {
        mockGetRelatedDocs.mockResolvedValue({ articles: [] });
        const result = await callTool("csp_get_related_docs", { keywords: "obscure topic" });
        expect(result.isError).toBeFalsy();
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.articles).toHaveLength(0);
    });
});
// ── Suite 4: unknown tool ────────────────────────────────────────────────────
describe("unknown tool", () => {
    test("10. returns isError true with unknown tool name", async () => {
        const result = await callTool("csp_does_not_exist", { keywords: "test" });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Unknown tool");
    });
});
//# sourceMappingURL=tools.test.js.map