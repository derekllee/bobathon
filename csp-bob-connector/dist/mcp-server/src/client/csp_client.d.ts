export interface CspCase {
    case_id: string;
    title: string;
    description_snippet: string;
    product: string;
    severity: string;
    status: string;
    resolution_summary: string;
    url: string;
}
export interface CspSearchResponse {
    total: number;
    cases: CspCase[];
}
export interface CspCaseDetail {
    case_id: string;
    title: string;
    description: string;
    resolution: string;
    root_cause: string;
    environment: Record<string, unknown>;
    components: string[];
    url: string;
}
export interface CspArticle {
    article_id: string;
    title: string;
    snippet: string;
    url: string;
}
export interface CspDocsResponse {
    articles: CspArticle[];
}
export interface SearchCasesParams {
    keywords: string;
    product?: string | undefined;
    severity?: string | undefined;
    status?: string | undefined;
    limit?: number | undefined;
}
export declare class CspApiError extends Error {
    readonly statusCode: number;
    constructor(statusCode: number, message: string);
}
export declare class CspClient {
    private readonly baseUrl;
    private readonly tokenProvider;
    constructor(baseUrl: string, tokenProvider: () => Promise<string>);
    searchCases(params: SearchCasesParams): Promise<CspSearchResponse>;
    getCase(caseId: string): Promise<CspCaseDetail>;
    getRelatedDocs(keywords: string, caseId?: string, limit?: number): Promise<CspDocsResponse>;
}
//# sourceMappingURL=csp_client.d.ts.map