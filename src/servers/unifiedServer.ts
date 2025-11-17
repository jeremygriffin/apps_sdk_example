import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { URL } from "node:url";

import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { config } from "@/config";
import { createLogger, logger as defaultLogger, Logger, shouldDebugToolCalls } from "@/logger";
import { createMcpServer } from "@/mcp/createServer";
import { readJsonBody, sanitizeHeaders } from "@/utils/http";
import { sanitizeStructuredContent } from "@/utils/sanitize";

export interface UnifiedServerOptions {
  host?: string;
  port?: number;
  ssePath?: string;
  sseMessagesPath?: string;
  streamPath?: string;
  logger?: Logger;
}

interface SseSession {
  transport: SSEServerTransport;
  close: () => Promise<void>;
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

const getQueryParams = (searchParams: URLSearchParams): Record<string, string | string[]> => {
  const params: Record<string, string | string[]> = {};
  searchParams.forEach((value, key) => {
    if (params[key]) {
      const existing = params[key];
      params[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      params[key] = value;
    }
  });
  return params;
};

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif"
};

const setTodoUiCorsHeaders = (res: http.ServerResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range, Accept");
};

const serveTodoUiAsset = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  log: Logger
) => {
  const mountPath = config.ui.mountPath;
  if (!config.ui.enabled || !url.pathname.startsWith(mountPath)) {
    return false;
  }
  const requestMeta = {
    method: req.method ?? "GET",
    path: url.pathname
  };
  const logAssetEvent = (status: number, data?: Record<string, unknown>) => {
    log.info("todo.ui.asset", {
      ...requestMeta,
      status,
      ...data
    });
  };
  const respondWithJson = (status: number, payload: unknown, data?: Record<string, unknown>) => {
    setTodoUiCorsHeaders(res);
    sendJson(res, status, payload);
    logAssetEvent(status, data);
  };

  if (!["GET", "HEAD", "OPTIONS"].includes(req.method ?? "GET")) {
    return false;
  }

  if (!config.ui.assetsAvailable) {
    respondWithJson(404, { error: "Todo UI bundle unavailable" }, { reason: "bundle_missing" });
    return true;
  }

  if (req.method === "OPTIONS") {
    setTodoUiCorsHeaders(res);
    res.setHeader("Cache-Control", "no-cache");
    res.writeHead(204);
    res.end();
    logAssetEvent(204, { kind: "preflight" });
    return true;
  }

  const trimmed = url.pathname.slice(mountPath.length);
  const pathname = trimmed.length > 0 ? trimmed : "/";
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const absolutePath = path.resolve(config.ui.distPath, relativePath);
  if (!absolutePath.startsWith(config.ui.distPath)) {
    respondWithJson(403, { error: "Forbidden" }, { asset: relativePath, reason: "path_traversal" });
    return true;
  }
  if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) {
    respondWithJson(404, { error: "Not found" }, { asset: relativePath, reason: "missing" });
    return true;
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
  setTodoUiCorsHeaders(res);
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", ext === ".html" ? "no-cache" : "public, max-age=300");

  if (req.method === "HEAD") {
    res.writeHead(200);
    res.end();
    logAssetEvent(200, { asset: relativePath, kind: "head" });
    return true;
  }

  res.writeHead(200);
  logAssetEvent(200, { asset: relativePath });
  const stream = fs.createReadStream(absolutePath);
  stream.on("error", (error) => {
    log.error("failed to stream todo ui asset", {
      path: absolutePath,
      error: error instanceof Error ? error.message : String(error)
    });
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify({ error: "Failed to read asset" }));
  });
  stream.pipe(res);
  return true;
};

export const startUnifiedServer = (options: UnifiedServerOptions = {}) => {
  const host = options.host ?? config.server.host;
  const port = options.port ?? config.server.port;
  const ssePath = options.ssePath ?? config.server.ssePath;
  const sseMessagesPath = options.sseMessagesPath ?? config.server.sseMessagesPath;
  const streamPath = options.streamPath ?? config.server.streamPath;
  const serverLogger = options.logger ?? defaultLogger;

  const sseSessions = new Map<string, SseSession>();
  const streamSessions = new Map<string, StreamingSession>();

  const cleanupSseSession = async (sessionId: string) => {
    const session = sseSessions.get(sessionId);
    if (!session) {
      return;
    }
    sseSessions.delete(sessionId);
    serverLogger.info("SSE session closed", { sessionId });
    try {
      await session.close();
    } catch (error) {
      serverLogger.warn("failed to close SSE session", {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const cleanupStreamSession = async (sessionId: string, closeTransport = false) => {
    const session = streamSessions.get(sessionId);
    if (!session || session.closed) {
      return;
    }
    session.closed = true;
    streamSessions.delete(sessionId);
    serverLogger.info("Streamable HTTP session closed", { sessionId });
    try {
      if (closeTransport) {
        await session.transport.close();
      }
    } catch (error) {
      serverLogger.warn("failed to close stream transport", {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    try {
      await session.closeServer();
    } catch (error) {
      serverLogger.warn("failed to close MCP server", {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const debugEnabled = shouldDebugToolCalls(serverLogger);
    const requestStart = performance.now();
    const requestMeta = {
      method: req.method ?? "UNKNOWN",
      path: url.pathname,
      query: getQueryParams(url.searchParams),
      headers: sanitizeHeaders(req.headers),
      remoteAddress: req.socket.remoteAddress ?? "unknown"
    };

    if (debugEnabled) {
      serverLogger.debug("http.request", requestMeta);
    }

    const logTransportPayload = (
      direction: "inbound" | "outbound",
      channel: "sse" | "stream",
      sessionId: string,
      payload: unknown
    ) => {
      if (!debugEnabled) {
        return;
      }
      serverLogger.debug("mcp.transport.message", {
        direction,
        channel,
        sessionId,
        body: sanitizeStructuredContent(payload)
      });
    };

    let responseLogged = false;
    const logResponse = (overrides?: Record<string, unknown>) => {
      if (!debugEnabled || responseLogged) {
        return;
      }
      responseLogged = true;
      serverLogger.debug("http.response", {
        ...requestMeta,
        status: res.statusCode ?? 0,
        durationMs: performance.now() - requestStart,
        ...overrides
      });
    };

    res.on("finish", () => {
      logResponse();
    });
    res.on("close", () => {
      if (!res.writableEnded) {
        logResponse({ aborted: true });
      }
    });

    try {
      if (serveTodoUiAsset(req, res, url, serverLogger)) {
        return;
      }

      if (req.method === "OPTIONS") {
        sendJson(res, 204, {});
        return;
      }

      if (req.method === "GET" && url.pathname === "/healthz") {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (req.method === "GET" && url.pathname === ssePath) {
        const sessionLogger = createLogger(serverLogger.getLevel());
        const mcpServer = createMcpServer({ logger: sessionLogger });
        const transport = new SSEServerTransport(sseMessagesPath, res);
        const sessionId = transport.sessionId;
        if (debugEnabled) {
          const originalSend = transport.send.bind(transport);
          transport.send = async (message) => {
            logTransportPayload("outbound", "sse", sessionId, message);
            await originalSend(message);
          };
        }

        const close = async () => {
          await mcpServer.close();
        };

        transport.onclose = () => {
          void cleanupSseSession(sessionId);
        };
        transport.onerror = (error) => {
          serverLogger.error("sse transport error", {
            sessionId,
            error: error instanceof Error ? error.message : String(error)
          });
        };

        sseSessions.set(sessionId, { transport, close });
        await mcpServer.connect(transport);
        serverLogger.info("SSE session established", { sessionId });
        return;
      }

      if (req.method === "POST" && url.pathname === sseMessagesPath) {
        const sessionId = url.searchParams.get("sessionId");
        if (!sessionId || !sseSessions.has(sessionId)) {
          sendJson(res, 404, { ok: false, error: "Session not found" });
          return;
        }
        const session = sseSessions.get(sessionId)!;
        let body: unknown;
        try {
          body = await readJsonBody(req);
        } catch (error) {
          sendJson(res, 400, { ok: false, error: "Invalid JSON" });
          return;
        }
        logTransportPayload("inbound", "sse", sessionId, body);
        await session.transport.handlePostMessage(req, res, body);
        return;
      }

      if (url.pathname === streamPath) {
        if (req.method === "POST") {
          let body: unknown;
          try {
            body = await readJsonBody(req);
          } catch {
            sendJson(res, 400, { ok: false, error: "Invalid JSON" });
            return;
          }

          const sessionIdHeader = getSessionIdHeader(req);
          if (sessionIdHeader && streamSessions.has(sessionIdHeader)) {
            const { transport } = streamSessions.get(sessionIdHeader)!;
            await transport.handleRequest(req, res, body);
            return;
          }

          if (!sessionIdHeader && isInitializeRequest(body)) {
            const transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              enableJsonResponse: true,
              onsessioninitialized: (sessionId) => {
                session.id = sessionId;
                streamSessions.set(sessionId, session);
                serverLogger.info("Streamable HTTP session initialized", { sessionId });
              },
              onsessionclosed: (sessionId) => {
                void cleanupStreamSession(sessionId);
              }
            });
            const sessionLogger = createLogger(serverLogger.getLevel());
            const mcpServer = createMcpServer({ logger: sessionLogger });
            const session: StreamingSession = {
              id: "",
              transport,
              closeServer: () => mcpServer.close(),
              closed: false
            };

            transport.onclose = () => {
              if (session.id) {
                void cleanupStreamSession(session.id);
              }
            };

            await mcpServer.connect(transport);
            await transport.handleRequest(req, res, body);

            if (!session.id && transport.sessionId) {
              session.id = transport.sessionId;
              streamSessions.set(session.id, session);
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
          const sessionId = getSessionIdHeader(req);
          if (!sessionId || !streamSessions.has(sessionId)) {
            sendJson(res, 400, { ok: false, error: "Invalid or missing session" });
            return;
          }
          const { transport } = streamSessions.get(sessionId)!;
          await transport.handleRequest(req, res);
          return;
        }

        sendJson(res, 405, { ok: false, error: "Method not allowed" });
        return;
      }

      sendJson(res, 404, { ok: false, error: "Not Found" });
    } catch (error) {
      serverLogger.error("Unified server error", {
        error: error instanceof Error ? error.message : String(error)
      });
      if (!res.headersSent) {
        sendJson(res, 500, { ok: false, error: "Internal Server Error" });
      }
    }
  });

  server.on("close", () => {
    sseSessions.forEach((_session, sessionId) => {
      void cleanupSseSession(sessionId);
    });
    sseSessions.clear();
    streamSessions.forEach((_session, sessionId) => {
      void cleanupStreamSession(sessionId, true);
    });
    streamSessions.clear();
  });

  server.listen(port, host, () => {
    serverLogger.info("Unified MCP server listening", {
      host,
      port,
      ssePath,
      sseMessagesPath,
      streamPath,
      envFile: config.configSources.envFileFound ? config.configSources.envFilePath : null
    });
  });

  return server;
};
