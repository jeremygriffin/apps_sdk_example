import http from "node:http";
import { URL } from "node:url";

import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

import { config } from "../config";
import { logger } from "../logger";
import { createMcpServer } from "../mcp/createServer";
import { readJsonBody } from "../utils/http";

export interface SseServerOptions {
  port?: number;
  host?: string;
  path?: string;
  messagePath?: string;
}

interface SseSession {
  transport: SSEServerTransport;
  close: () => Promise<void>;
}

const sendJson = (res: http.ServerResponse, status: number, payload: unknown) => {
  if (res.headersSent) {
    res.end();
    return;
  }
  if (status === 204) {
    res.writeHead(status);
    res.end();
    return;
  }
  res.writeHead(status, {
    "Content-Type": "application/json"
  });
  res.end(JSON.stringify(payload));
};

export const startSseServer = (options: SseServerOptions = {}) => {
  const port = options.port ?? config.sse.port;
  const host = options.host ?? config.sse.host;
  const path = options.path ?? config.sse.path;
  const messagePath = options.messagePath ?? config.sse.messagePath;

  const sessions = new Map<string, SseSession>();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    try {
      if (req.method === "GET" && url.pathname === path) {
        const mcpServer = createMcpServer();
        const transport = new SSEServerTransport(messagePath, res);
        const sessionId = transport.sessionId;

        const cleanup = async () => {
          sessions.delete(sessionId);
          logger.info("SSE session closed", { sessionId });
          try {
            await mcpServer.close();
          } catch (error) {
            logger.warn("failed to close SSE MCP server", {
              error: error instanceof Error ? error.message : String(error)
            });
          }
        };

        transport.onclose = () => {
          void cleanup();
        };
        transport.onerror = (error) => {
          logger.error("sse transport error", {
            sessionId,
            error: error instanceof Error ? error.message : String(error)
          });
        };

        sessions.set(sessionId, {
          transport,
          close: cleanup
        });

        await mcpServer.connect(transport);
        logger.info("SSE session established", { sessionId });
        return;
      }

      if (req.method === "POST" && url.pathname === messagePath) {
        const sessionId = url.searchParams.get("sessionId");
        if (!sessionId || !sessions.has(sessionId)) {
          sendJson(res, 404, { ok: false, error: "Session not found" });
          return;
        }
        const session = sessions.get(sessionId)!;
        let body: unknown;
        try {
          body = await readJsonBody(req);
        } catch (error) {
          sendJson(res, 400, { ok: false, error: "Invalid JSON" });
          return;
        }
        await session.transport.handlePostMessage(req, res, body);
        return;
      }

      if (req.method === "GET" && url.pathname === "/healthz") {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (req.method === "OPTIONS") {
        sendJson(res, 204, {});
        return;
      }

      sendJson(res, 404, { ok: false, error: "Not Found" });
    } catch (error) {
      logger.error("SSE server error", {
        error: error instanceof Error ? error.message : String(error)
      });
      if (!res.headersSent) {
        sendJson(res, 500, { ok: false, error: "Internal Server Error" });
      }
    }
  });

  server.on("close", () => {
    sessions.forEach((session) => {
      void session.close();
    });
    sessions.clear();
  });

  server.listen(port, host, () => {
    logger.info("MCP SSE server listening", {
      host,
      port,
      path,
      messagePath
    });
  });

  return server;
};
