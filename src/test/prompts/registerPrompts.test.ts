import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";

import { registerPromptsWithServer } from "../../mcp/registerPrompts";
import { prompts } from "../../prompts/promptRegistry";
import { createSilentLogger } from "../helpers/logger";

describe("registerPromptsWithServer", () => {
  const createServer = () =>
    new McpServer(
      { name: "test-server", version: "0.0.0" },
      {
        capabilities: {
          logging: {}
        }
      }
    );

  const getRequestHandler = (server: McpServer, method: string) => {
    const handlers = (server.server as unknown as { _requestHandlers: Map<string, any> })._requestHandlers;
    return handlers.get(method);
  };

  it("registers prompt capabilities and handlers", async () => {
    const server = createServer();
    registerPromptsWithServer(server, createSilentLogger());

    const capabilities = (server.server as unknown as { _capabilities: Record<string, unknown> })._capabilities;
    expect(capabilities.prompts).toEqual({});

    const listHandler = getRequestHandler(server, "prompts/list");
    expect(listHandler).toBeTypeOf("function");

    const listResult = await listHandler(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "prompts/list",
        params: {}
      },
      {}
    );

    expect(listResult.prompts).toHaveLength(prompts.length);

    const promptName = prompts[0].name;
    const getHandler = getRequestHandler(server, "prompts/get");
    expect(getHandler).toBeTypeOf("function");
    const getResult = await getHandler(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "prompts/get",
        params: {
          name: promptName,
          arguments: {
            [prompts[0].arguments[0].name]: "example"
          }
        }
      },
      {}
    );

    expect(getResult.description).toBe(prompts[0].description);
    expect(Array.isArray(getResult.messages)).toBe(true);
    expect(getResult.messages.length).toBeGreaterThan(0);
  });
});
