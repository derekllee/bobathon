"use strict";
// Stub — replace with real HTTP implementation once Team Member B provides endpoint + auth details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CspClient = exports.CspApiError = void 0;
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
    baseUrl;
    tokenProvider;
    constructor(baseUrl, tokenProvider) {
        this.baseUrl = baseUrl;
        this.tokenProvider = tokenProvider;
    }
    async searchCases(params) {
        // TODO: replace stub with real HTTP call
        // POST ${this.baseUrl}/cases/search
        void params;
        void (await this.tokenProvider());
        return { total: 0, cases: [] };
    }
    async getCase(caseId) {
        // TODO: replace stub with real HTTP call
        // GET ${this.baseUrl}/cases/${caseId}
        void caseId;
        void (await this.tokenProvider());
        return {
            case_id: caseId,
            title: "",
            description: "",
            resolution: "",
            root_cause: "",
            environment: {},
            components: [],
            url: "",
        };
    }
    async getRelatedDocs(keywords, caseId, limit) {
        // TODO: replace stub with real HTTP call
        void keywords;
        void caseId;
        void limit;
        void (await this.tokenProvider());
        return { articles: [] };
    }
}
exports.CspClient = CspClient;
//# sourceMappingURL=csp_client.js.map