/**
 * client-template.ts — HTTP Client
 *
 * [CUSTOMIZE: Replace "My" prefix throughout with a name that reflects your system,
 *  e.g. "Jira", "ServiceNow", "Salesforce".]
 *
 * Pattern:
 *  - Constructor takes a base URL and a token provider (async () => string).
 *  - All requests add Authorization: Bearer {token}.
 *  - Non-2xx responses throw MyApiError with a status code.
 *  - FIXTURE_MODE=true skips real HTTP and returns canned JSON from
 *    test/fixtures/responses.json — safe to use in demos and CI.
 */

import axios, { AxiosInstance } from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, "../test/fixtures/responses.json");
// [CUSTOMIZE: adjust path if your fixtures file lives elsewhere]

// ─── Error class ──────────────────────────────────────────────────────────────

export class MyApiError extends Error {
  // [CUSTOMIZE: rename to match your system, e.g. JiraApiError]
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "MyApiError";
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
// [CUSTOMIZE: Replace these interfaces with shapes that match your API responses.
//  Keep the naming style: SearchParams, SearchResponse, ItemDetail, RelatedResponse.]

export interface SearchParams {
  keywords: string;
  filter?:  string;
  limit?:   number;
}

export interface SearchResult {
  id:      string;  // [CUSTOMIZE: your resource's primary ID field]
  title:   string;
  snippet: string;  // [CUSTOMIZE: brief summary field]
  status:  string;
  url:     string;
}

export interface SearchResponse {
  total:   number;
  results: SearchResult[];
}

export interface ItemDetail {
  id:          string;
  title:       string;
  description: string;
  resolution?: string;  // [CUSTOMIZE: remove if not applicable]
  root_cause?: string;  // [CUSTOMIZE: remove if not applicable]
  url:         string;
}

export interface RelatedItem {
  id:      string;
  title:   string;
  snippet: string;
  url:     string;
}

export interface RelatedResponse {
  items: RelatedItem[]; // [CUSTOMIZE: rename field to match your domain]
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class MyClient {
  // [CUSTOMIZE: rename to match your system]
  private baseUrl:       string;
  private tokenProvider: () => Promise<string>;
  private http:          AxiosInstance;
  private fixtures:      Record<string, any> | null = null;

  constructor(baseUrl: string, tokenProvider: () => Promise<string>) {
    this.baseUrl       = baseUrl.replace(/\/$/, ""); // strip trailing slash
    this.tokenProvider = tokenProvider;
    this.http          = axios.create({ timeout: 15_000 });

    if (process.env.FIXTURE_MODE === "true") {
      this.fixtures = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
      console.log("[MyClient] FIXTURE_MODE enabled — using canned responses.");
    }
  }

  // ─── search ────────────────────────────────────────────────────────────────
  // [CUSTOMIZE: rename method + update endpoint path + request body shape]

  async search(params: SearchParams): Promise<SearchResponse> {
    if (this.fixtures) return this.fixtureSearch(params.keywords);

    const token = await this.tokenProvider();

    // [CUSTOMIZE: replace with your search endpoint and body structure]
    const body = {
      query:  params.keywords,
      filter: params.filter,
      limit:  params.limit ?? 10,
    };

    const raw = await this.post("/search", body, token);
    return this.normalizeSearch(raw);
  }

  // ─── getItem ───────────────────────────────────────────────────────────────
  // [CUSTOMIZE: rename method + update endpoint path (GET vs POST)]

  async getItem(itemId: string): Promise<ItemDetail> {
    if (this.fixtures) return this.fixtureItem(itemId);

    const token = await this.tokenProvider();

    // [CUSTOMIZE: use this.get() if your API uses GET with a path param]
    const raw = await this.get(`/items/${encodeURIComponent(itemId)}`, token);
    return this.normalizeItem(raw, itemId);
  }

  // ─── getRelated ────────────────────────────────────────────────────────────
  // [CUSTOMIZE: rename method or remove entirely if not needed]

  async getRelated(keywords: string, itemId?: string, limit = 5): Promise<RelatedResponse> {
    if (this.fixtures) return this.fixtureRelated(keywords);

    const token = await this.tokenProvider();

    // [CUSTOMIZE: replace with your related-content endpoint]
    const body = { keywords, item_id: itemId, limit };
    const raw  = await this.post("/related", body, token);
    return this.normalizeRelated(raw);
  }

  // ─── HTTP helpers ──────────────────────────────────────────────────────────

  private async post(path: string, body: unknown, token: string): Promise<any> {
    try {
      const res = await this.http.post(`${this.baseUrl}${path}`, body, {
        headers: {
          Authorization:  `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      return res.data;
    } catch (err: any) {
      throw this.wrapError(err);
    }
  }

  private async get(path: string, token: string): Promise<any> {
    try {
      const res = await this.http.get(`${this.baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    } catch (err: any) {
      throw this.wrapError(err);
    }
  }

  private wrapError(err: any): MyApiError {
    // [CUSTOMIZE: add system-specific status code handling as needed]
    const status = err.response?.status ?? 0;
    const msg    =
      err.response?.data?.message ??
      err.response?.data?.error   ??
      err.message;

    if (status === 401) return new MyApiError(401, `Authentication failed: ${msg}`);
    if (status === 403) return new MyApiError(403, `Forbidden: ${msg}`);
    if (status === 404) return new MyApiError(404, `Not found: ${msg}`);
    return new MyApiError(status, `API error (${status}): ${msg}`);
  }

  // ─── Response normalizers ──────────────────────────────────────────────────
  // [CUSTOMIZE: map your actual API response fields onto the typed interfaces above.
  //  Add ?? fallbacks for every field so partial responses don't throw.]

  private normalizeSearch(raw: any): SearchResponse {
    const items: SearchResult[] = (raw?.results ?? raw?.items ?? []).map((r: any) => ({
      id:      r.id      ?? r.Id      ?? "",
      title:   r.title   ?? r.name    ?? "",
      snippet: (r.snippet ?? r.description ?? "").substring(0, 300),
      status:  r.status  ?? "unknown",
      url:     r.url     ?? `${this.baseUrl}/items/${r.id ?? ""}`,
    }));
    return { total: raw?.total ?? items.length, results: items };
  }

  private normalizeItem(raw: any, itemId: string): ItemDetail {
    return {
      id:          itemId,
      title:       raw?.title       ?? raw?.name        ?? "",
      description: raw?.description ?? raw?.body        ?? "",
      resolution:  raw?.resolution  ?? raw?.resolution_notes ?? undefined,
      root_cause:  raw?.root_cause  ?? undefined,
      url:         raw?.url         ?? `${this.baseUrl}/items/${itemId}`,
    };
  }

  private normalizeRelated(raw: any): RelatedResponse {
    const items: RelatedItem[] = (raw?.items ?? raw?.articles ?? []).map((a: any) => ({
      id:      a.id      ?? a.article_id ?? "",
      title:   a.title   ?? "",
      snippet: a.snippet ?? "",
      url:     a.url     ?? "",
    }));
    return { items };
  }

  // ─── Fixture helpers ───────────────────────────────────────────────────────
  // [CUSTOMIZE: update key names to match your fixtures/responses.json structure]

  private fixtureSearch(keywords: string): SearchResponse {
    // Simple keyword-based fixture routing — add more branches as needed
    const key = keywords.toLowerCase();
    const fixtureKey = key.includes("error") ? "search_errors"
                     : key.includes("timeout") ? "search_timeouts"
                     : "search_default"; // [CUSTOMIZE: key names]
    return this.fixtures![fixtureKey] ?? { total: 0, results: [] };
  }

  private fixtureItem(itemId: string): ItemDetail {
    const items: ItemDetail[] = this.fixtures!["item_detail"] ?? []; // [CUSTOMIZE: key name]
    return (
      items.find((i) => i.id === itemId) ??
      items[0] ?? {
        id: itemId, title: "Fixture item", description: "Fixture description", url: "",
      }
    );
  }

  private fixtureRelated(_keywords: string): RelatedResponse {
    return this.fixtures!["related"] ?? { items: [] }; // [CUSTOMIZE: key name]
  }
}
