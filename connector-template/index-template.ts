/**
 * index-template.ts — MCP Server Entry Point
 *
 * [CUSTOMIZE: Replace "my-connector" with your connector's name throughout this file.]
 * [CUSTOMIZE: Replace MyClient with your client class name.]
 * [CUSTOMIZE: Replace MyApiError with your API error class name.]
 *
 * Registers all tools with the MCP server and wires them to the HTTP client.
 * Uses stdio transport so Bob can launch this as a subprocess.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MyClient, MyApiError } from "./client-template.js"; // [CUSTOMIZE: update import path]

// ── Input schemas ─────────────────────────────────────────────────────────────
// [CUSTOMIZE: Define one Zod schema per tool. Use .parse() in each handler to
//  validate and coerce args before passing them to the client.]

const SearchInput = z.object({
  keywords: z.string().min(1), // [CUSTOMIZE: rename + add/remove fields]
  filter:   z.string().optional(),
  limit:    z.number().int().min(1).max(20).default(10),
});

const GetItemInput = z.object({
  item_id: z.string().min(1), // [CUSTOMIZE: rename to match your resource ID field]
});

const GetRelatedInput = z.object({
  keywords: z.string().min(1),
  item_id:  z.string().optional(),
  limit:    z.number().int().min(1).max(10).default(5),
});

// ── Client instantiation ──────────────────────────────────────────────────────
// [CUSTOMIZE: Pass the base URL and a token provider matching your auth layer.
//  For OAuth2 / IAM, swap the lambda for a call to your TokenManager.getToken().]

const client = new MyClient(
  process.env["MY_API_BASE_URL"] ?? "https://my-internal-api.example.com/api/v1",
  async () => process.env["MY_API_TOKEN"] ?? "",
);

// ── Server setup ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: "my-connector", version: "0.1.0" }, // [CUSTOMIZE: connector name + version]
  { capabilities: { tools: {} } },
);

// ── tools/list ────────────────────────────────────────────────────────────────
// [CUSTOMIZE: Update tool names, descriptions, and inputSchema properties to
//  match the tools you are exposing. Keep required[] in sync with Zod schemas above.]

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "my_search",               // [CUSTOMIZE: tool name]
      description:
        "Search [SYSTEM] for [RESOURCE TYPE]. Always call this first.", // [CUSTOMIZE]
      inputSchema: {
        type: "object",
        properties: {
          keywords: { type: "string" },
          filter:   { type: "string" },
          limit:    { type: "integer", minimum: 1, maximum: 20, default: 10 },
        },
        required: ["keywords"],
      },
    },
    {
      name: "my_get_item",             // [CUSTOMIZE: tool name]
      description: "Get full details for a [RESOURCE] by ID.", // [CUSTOMIZE]
      inputSchema: {
        type: "object",
        properties: {
          item_id: { type: "string" }, // [CUSTOMIZE: field name]
        },
        required: ["item_id"],
      },
    },
    {
      name: "my_get_related",          // [CUSTOMIZE: tool name or remove entirely]
      description: "Get related [RESOURCES] for keywords or an item ID.", // [CUSTOMIZE]
      inputSchema: {
        type: "object",
        properties: {
          keywords: { type: "string" },
          item_id:  { type: "string" },
          limit:    { type: "integer", minimum: 1, maximum: 10, default: 5 },
        },
        required: ["keywords"],
      },
    },
  ],
}));

// ── tools/call ────────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    if (name === "my_search") {                  // [CUSTOMIZE: match tool names above]
      const input  = SearchInput.parse(args);
      const result = await client.search(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    if (name === "my_get_item") {                // [CUSTOMIZE]
      const input  = GetItemInput.parse(args);
      const result = await client.getItem(input.item_id);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    if (name === "my_get_related") {             // [CUSTOMIZE]
      const input  = GetRelatedInput.parse(args);
      const result = await client.getRelated(input.keywords, input.item_id, input.limit);
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

// ── Start ─────────────────────────────────────────────────────────────────────

(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
})();
