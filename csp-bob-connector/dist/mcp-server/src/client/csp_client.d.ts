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
import { IamTokenManager } from "../auth/iam_auth.js";
export interface CspSearchParams {
    keywords: string;
    product?: string | undefined;
    severity?: "1" | "2" | "3" | "4" | "any" | undefined;
    status?: "open" | "closed" | "all" | undefined;
    limit?: number | undefined;
}
export interface CspCase {
    case_id: string;
    case_number: string;
    title: string;
    description_snippet: string;
    product?: string;
    severity?: string;
    status: string;
    resolution_summary?: string;
    url: string;
}
export interface CspSearchResponse {
    total: number;
    cases: CspCase[];
}
export interface CspCaseDetail {
    case_id: string;
    case_number: string;
    title: string;
    description: string;
    resolution: string;
    root_cause?: string;
    environment?: Record<string, string>;
    components?: string[];
    keywords?: string;
    url: string;
}
export interface CspDocsResponse {
    articles: Array<{
        article_id: string;
        title: string;
        snippet: string;
        url: string;
    }>;
}
export declare class CspApiError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string);
}
export interface CspClientConfig {
    auth: IamTokenManager;
    apiGatewayUrl?: string;
    sfCaseBotUrl?: string;
}
export declare class CspClient {
    private auth;
    private apiGatewayUrl;
    private sfCaseBotUrl;
    private http;
    private fixtures;
    constructor(config: CspClientConfig);
    searchCases(params: CspSearchParams): Promise<CspSearchResponse>;
    getCase(caseId: string): Promise<CspCaseDetail>;
    getRelatedDocs(keywords: string, caseId?: string, limit?: number): Promise<CspDocsResponse>;
    private post;
    private normalizeSearchResponse;
    private normalizeCaseDetail;
    private fixtureSearch;
    private fixtureGetCase;
    private fixtureDocs;
}
//# sourceMappingURL=csp_client.d.ts.map