import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { CspClient } from "./client/csp_client.js";
import { createTokenManager } from "./auth/iam_auth.js";

// ── Input schemas ────────────────────────────────────────────────────────────

const SearchCasesInput = z.object({
  keywords: z.string(),
  product: z.string().optional(),
  severity: z.enum(["1", "2", "3", "4", "any"]).optional(),
  status: z.enum(["open", "closed", "all"]).optional(),
  limit: z.number().int().min(1).max(20).default(10),
});

const GetCaseInput = z.object({
  case_id: z.string(),
});

const GetRelatedDocsInput = z.object({
  keywords: z.string(),
  case_id: z.string().optional(),
  limit: z.number().int().min(1).max(10).default(5),
});

// ── Server setup ─────────────────────────────────────────────────────────────

// In FIXTURE_MODE, no real credentials are needed — IamTokenManager is not called.
// In live mode, set CSP_CLIENT_ID and CSP_CLIENT_SECRET env vars.
const auth = process.env.FIXTURE_MODE === "true"
  ? { getToken: async () => "" } as any
  : createTokenManager();

const client = new CspClient({ auth });

const server = new Server(
  { name: "csp-connector", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// ── tools/list ───────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "csp_search_cases",
      description:
        "Search IBM CSP for historical support cases. Always call this before root cause analysis.",
      inputSchema: {
        type: "object",
        properties: {
          keywords: { type: "string" },
          product: { type: "string" },
          severity: { type: "string", enum: ["1", "2", "3", "4", "any"] },
          status: { type: "string", enum: ["open", "closed", "all"] },
          limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
        },
        required: ["keywords"],
      },
    },
    {
      name: "csp_get_case",
      description:
        "Get full detail of a CSP case by ID. Use after csp_search_cases.",
      inputSchema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
        },
        required: ["case_id"],
      },
    },
    {
      name: "csp_get_related_docs",
      description: "Get related IBM KB articles for keywords or a case.",
      inputSchema: {
        type: "object",
        properties: {
          keywords: { type: "string" },
          case_id: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
        },
        required: ["keywords"],
      },
    },
  ],
}));

// ── tools/call ───────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    if (name === "csp_search_cases") {
      const input = SearchCasesInput.parse(args);
      const result = await client.searchCases(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    if (name === "csp_get_case") {
      const input = GetCaseInput.parse(args);
      const result = await client.getCase(input.case_id);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    if (name === "csp_get_related_docs") {
      const input = GetRelatedDocsInput.parse(args);
      const result = await client.getRelatedDocs(
        input.keywords,
        input.case_id,
        input.limit
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    return {
      content: [{ type: "text", text: `Error: Unknown tool "${name}"` }],
      isError: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ── Start ────────────────────────────────────────────────────────────────────

(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
})();
