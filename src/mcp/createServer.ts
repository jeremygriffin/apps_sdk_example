import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerToolsWithServer } from "./registerTools";
import { registerPromptsWithServer } from "./registerPrompts";

const SERVER_NAME = "todo-mcp";

export const createMcpServer = () => {
  const serverVersion = process.env.npm_package_version ?? "0.0.0";
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: serverVersion
    },
    {
      capabilities: {
        logging: {}
      }
    }
  );

  registerToolsWithServer(server);
  registerPromptsWithServer(server);
  return server;
};
