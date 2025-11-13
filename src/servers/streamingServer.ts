import http from "node:http";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { config } from "../config";
import { logger } from "../logger";
import { createMcpServer } from "../mcp/createServer";
import { readJsonBody } from "../utils/http";

export interface StreamingServerOptions {
  port?: number;
  host?: string;
  path?: string;
}

interface StreamingSession {
  id: string;
  transport: StreamableHTTPServerTransport;
  closeServer: () => Promise<void>;
  closed: boolean;
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

const getSessionIdHeader = (req: http.IncomingMessage): string | undefined => {
  const value = req.headers["mcp-session-id"];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    const entry = value.find((candidate) => candidate.trim().length > 0);
    return entry?.trim();
  }
  return undefined;
};

export const startStreamingServer = (options: StreamingServerOptions = {}) => {
  const port = options.port ?? config.streaming.port;
  const host = options.host ?? config.streaming.host;
  const path = options.path ?? config.streaming.path;

  const sessions = new Map<string, StreamingSession>();

  const cleanupSession = async (sessionId: string, closeTransport = false) => {
    const session = sessions.get(sessionId);
    if (!session || session.closed) {
      return;
    }
    session.closed = true;
    sessions.delete(sessionId);
    logger.info("Streamable HTTP session closed", { sessionId });
    try {
      if (closeTransport) {
        await session.transport.close();
      }
    } catch (error) {
      logger.warn("failed to close transport", {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    try {
      await session.closeServer();
    } catch (error) {
      logger.warn("failed to close MCP server", {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    try {
      if (req.method === "GET" && url.pathname === "/healthz") {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (url.pathname !== path) {
        sendJson(res, 404, { ok: false, error: "Not Found" });
        return;
      }

      if (req.method === "POST") {
        let body: unknown;
        try {
          body = await readJsonBody(req);
        } catch {
          sendJson(res, 400, { ok: false, error: "Invalid JSON" });
          return;
        }

        const sessionIdHeader = getSessionIdHeader(req);
        if (sessionIdHeader && sessions.has(sessionIdHeader)) {
          const { transport } = sessions.get(sessionIdHeader)!;
          await transport.handleRequest(req, res, body);
          return;
        }

        if (!sessionIdHeader && isInitializeRequest(body)) {
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            enableJsonResponse: true,
            onsessioninitialized: (sessionId) => {
              session.id = sessionId;
              sessions.set(sessionId, session);
              logger.info("Streamable HTTP session initialized", { sessionId });
            },
            onsessionclosed: (sessionId) => {
              void cleanupSession(sessionId);
            }
          });
          const mcpServer = createMcpServer();
          const session: StreamingSession = {
            id: "",
            transport,
            closeServer: () => mcpServer.close(),
            closed: false
          };

          transport.onclose = () => {
            if (session.id) {
              void cleanupSession(session.id);
            }
          };

          await mcpServer.connect(transport);
          await transport.handleRequest(req, res, body);

          if (!session.id && transport.sessionId) {
            session.id = transport.sessionId;
            sessions.set(session.id, session);
          }
          return;
        }

        sendJson(res, 400, {
          ok: false,
          error: "Missing session or not an initialization request"
        });
        return;
      }

      if (req.method === "GET" || req.method === "DELETE") {
        const sessionIdHeader = getSessionIdHeader(req);
        if (!sessionIdHeader || !sessions.has(sessionIdHeader)) {
          sendJson(res, 400, { ok: false, error: "Invalid or missing session" });
          return;
        }
        const { transport } = sessions.get(sessionIdHeader)!;
        await transport.handleRequest(req, res);
        return;
      }

      sendJson(res, 405, { ok: false, error: "Method not allowed" });
    } catch (error) {
      logger.error("Streaming server error", {
        error: error instanceof Error ? error.message : String(error)
      });
      if (!res.headersSent) {
        sendJson(res, 500, { ok: false, error: "Internal Server Error" });
      }
    }
  });

  server.on("close", () => {
    sessions.forEach((_session, sessionId) => {
      void cleanupSession(sessionId, true);
    });
    sessions.clear();
  });

  server.listen(port, host, () => {
    logger.info("Streamable HTTP server listening", {
      host,
      port,
      path
    });
  });

  return server;
};
