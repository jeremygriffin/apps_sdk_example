import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError, SetLevelRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { isLogLevel, logger as defaultLogger, Logger } from "@/logger";
import { registerToolsWithServer } from "./registerTools";
import { registerPromptsWithServer } from "./registerPrompts";

const SERVER_NAME = "todo-mcp";

export interface CreateMcpServerOptions {
  logger?: Logger;
}

export const wireLoggingCapability = (server: McpServer, log: Logger) => {
  const loggingMethod = SetLevelRequestSchema.shape.method.value;

  server.server.registerCapabilities({
    logging: {}
  });
  server.server.assertCanSetRequestHandler(loggingMethod);
  server.server.setRequestHandler(SetLevelRequestSchema, async (request) => {
    const requestedLevel = request.params.level;
    if (!isLogLevel(requestedLevel)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unsupported log level: ${String(requestedLevel)}`
      );
    }
    log.setLevel(requestedLevel);
    return {};
  });

  log.sendLogMessage = (level, loggerName, data) => {
    void server.server.notification({
      method: "notifications/message",
      params: {
        level,
        logger: loggerName,
        data: data ?? {}
      }
    });
  };
};

export const createMcpServer = (options: CreateMcpServerOptions = {}) => {
  const activeLogger = options.logger ?? defaultLogger;
  const serverVersion = process.env.npm_package_version ?? "0.0.0";
  const server = new McpServer({
    name: SERVER_NAME,
    version: serverVersion
  });

  wireLoggingCapability(server, activeLogger);
  registerToolsWithServer(server, activeLogger);
  registerPromptsWithServer(server, activeLogger);

  const originalClose = server.close.bind(server);
  server.close = async () => {
    activeLogger.sendLogMessage = () => {};
    await originalClose();
  };

  return server;
};
