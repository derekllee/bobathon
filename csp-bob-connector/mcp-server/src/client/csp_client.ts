// Stub — replace with real HTTP implementation once Team Member B provides endpoint + auth details.

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

export class CspApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "CspApiError";
  }
}

export class CspClient {
  constructor(
    private readonly baseUrl: string,
    private readonly tokenProvider: () => Promise<string>
  ) {}

  async searchCases(params: SearchCasesParams): Promise<CspSearchResponse> {
    // TODO: replace stub with real HTTP call
    // POST ${this.baseUrl}/cases/search
    void params;
    void (await this.tokenProvider());
    return { total: 0, cases: [] };
  }

  async getCase(caseId: string): Promise<CspCaseDetail> {
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

  async getRelatedDocs(
    keywords: string,
    caseId?: string,
    limit?: number
  ): Promise<CspDocsResponse> {
    // TODO: replace stub with real HTTP call
    void keywords;
    void caseId;
    void limit;
    void (await this.tokenProvider());
    return { articles: [] };
  }
}
