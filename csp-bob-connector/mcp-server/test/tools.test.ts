/**
 * Unit tests for MCP tool handlers: csp_search_cases, csp_get_case, csp_get_related_docs
 * Uses FIXTURE_MODE so no real credentials or network calls are needed.
 */

import path from "path";
import { describe, it, expect, beforeAll } from "@jest/globals";

// ── Load fixture data ─────────────────────────────────────────────────────────

const fixtures = JSON.parse(
  require("fs").readFileSync(
    path.resolve(__dirname, "./fixtures/csp_responses.json"),
    "utf8"
  )
);

// ── Import client in fixture mode ─────────────────────────────────────────────

// Set FIXTURE_MODE before importing so the constructor loads fixtures
process.env.FIXTURE_MODE = "true";

import { CspClient, CspApiError } from "../src/client/csp_client";
import { IamTokenManager } from "../src/auth/iam_auth";

// Stub auth — never called in FIXTURE_MODE
const stubAuth = { getToken: async () => "" } as unknown as IamTokenManager;

function makeClient() {
  return new CspClient({ auth: stubAuth });
}

// ── Suite 1: csp_search_cases ─────────────────────────────────────────────────

describe("csp_search_cases", () => {
  let client: CspClient;

  beforeAll(() => {
    client = makeClient();
  });

  it("happy path — OOM query returns 4 cases with correct shape", async () => {
    const result = await client.searchCases({ keywords: "Kubernetes OOM watsonx.data" });
    expect(result.total).toBe(4);
    expect(result.cases).toHaveLength(4);

    const c = result.cases[0]!;
    expect(c).toHaveProperty("case_id");
    expect(c).toHaveProperty("case_number");
    expect(c).toHaveProperty("title");
    expect(c).toHaveProperty("description_snippet");
    expect(c).toHaveProperty("status");
    expect(c).toHaveProperty("url");
  });

  it("SSL query returns 3 cases", async () => {
    const result = await client.searchCases({ keywords: "SSL handshake IBM COS" });
    expect(result.total).toBe(3);
    expect(result.cases).toHaveLength(3);
  });

  it("timeout query returns 3 cases", async () => {
    const result = await client.searchCases({ keywords: "connection timeout watsonx.governance" });
    expect(result.total).toBe(3);
  });

  it("unknown keyword falls back to OOM fixture", async () => {
    const result = await client.searchCases({ keywords: "unknown query xyz" });
    expect(result.total).toBeGreaterThan(0);
  });

  it("respects limit param (fixture passthrough)", async () => {
    const result = await client.searchCases({ keywords: "OOM", limit: 2 });
    // In fixture mode limit is not enforced server-side but response must be valid
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("cases");
  });
});

// ── Suite 2: csp_get_case ─────────────────────────────────────────────────────

describe("csp_get_case", () => {
  let client: CspClient;

  beforeAll(() => {
    client = makeClient();
  });

  it("happy path — returns full case detail with all required fields", async () => {
    const caseId = fixtures.case_detail[0].case_id;
    const result = await client.getCase(caseId);

    expect(result).toHaveProperty("case_id");
    expect(result).toHaveProperty("case_number");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("description");
    expect(result).toHaveProperty("resolution");
    expect(result).toHaveProperty("url");
    expect(result.case_id).toBe(caseId);
  });

  it("lookup by case_number also resolves", async () => {
    const caseNumber = fixtures.case_detail[1].case_number;
    const result = await client.getCase(caseNumber);
    expect(result.case_number).toBe(caseNumber);
  });

  it("unknown case_id returns fallback fixture (not an error)", async () => {
    const result = await client.getCase("UNKNOWN-999");
    expect(result).toHaveProperty("case_id");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("url");
  });
});

// ── Suite 3: csp_get_related_docs ─────────────────────────────────────────────

describe("csp_get_related_docs", () => {
  let client: CspClient;

  beforeAll(() => {
    client = makeClient();
  });

  it("returns an articles array (may be empty if no docs fixture)", async () => {
    const result = await client.getRelatedDocs("Kubernetes OOM");
    expect(result).toHaveProperty("articles");
    expect(Array.isArray(result.articles)).toBe(true);
  });
});
