import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";

import { createLogger } from "@/logger";
import { registerToolsWithServer } from "@/mcp/registerTools";
import { DEFAULT_TOOL_ANNOTATIONS, tools } from "@/toolRegistry";

vi.mock("@/ui/uiResources", () => ({
  getTodoUiWidgetMeta: () => undefined
}));

describe("registerToolsWithServer", () => {
  it("attaches annotations to every tool listing", () => {
    const registerTool = vi.fn();
    const stubServer = {
      registerTool
    } as unknown as McpServer;

    const log = createLogger("error", () => {});
    registerToolsWithServer(stubServer, log);

    expect(registerTool).toHaveBeenCalledTimes(tools.length);
    registerTool.mock.calls.forEach(([, definition]) => {
      expect(definition.annotations).toEqual(DEFAULT_TOOL_ANNOTATIONS);
    });
  });
});
