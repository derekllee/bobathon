"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const server = new index_js_1.Server({
    name: "echo-test",
    version: "0.0.1",
}, {
    capabilities: {
        tools: {},
    },
});
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "echo",
            description: "Echoes input",
            inputSchema: {
                type: "object",
                properties: {
                    message: {
                        type: "string",
                    },
                },
                required: ["message"],
            },
        },
    ],
}));
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (req) => ({
    content: [
        {
            type: "text",
            text: `Echo: ${req.params.arguments?.["message"]}`,
        },
    ],
}));
(async () => {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
})();
//# sourceMappingURL=echo-test.js.map