import http, { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

import { config } from "../config";
import { logger, maskSubjectId, shouldDebugToolCalls } from "../logger";
import { executeToolByName, getToolCatalog } from "../toolRegistry";
import { ToolMetadata } from "../types/tool";

export interface SseServerOptions {
  port?: number;
  host?: string;
  path?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Subject-Id, X-OpenAI-Subject"
};

const sendJson = (res: ServerResponse, status: number, payload: unknown) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...corsHeaders
  });
  res.end(JSON.stringify(payload));
};

const readRequestBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req
      .on("data", (chunk) => chunks.push(Buffer.from(chunk)))
      .on("error", reject)
      .on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });

const sanitizeHeaders = (headers: IncomingHttpHeaders): Record<string, unknown> => {
  const blocked = new Set(["authorization", "cookie"]);
  return Object.entries(headers).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (!blocked.has(key.toLowerCase())) {
      acc[key] = value ?? "";
    }
    return acc;
  }, {});
};

const extractSubjectFromHeaders = (headers: IncomingHttpHeaders): string | undefined => {
  const candidates = ["x-subject-id", "x-openai-subject", "openai-subject"];
  for (const key of candidates) {
    const value = headers[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const handleSseHandshake = (res: ServerResponse) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    ...corsHeaders
  });
  const payload = {
    type: "ready",
    tools: getToolCatalog()
  };
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const handleToolInvocation = async (
  req: IncomingMessage,
  res: ServerResponse,
  toolName: string
) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  try {
    const rawBody = await readRequestBody(req);
    const parsed = rawBody ? JSON.parse(rawBody) : {};
    const metadata: ToolMetadata = parsed.metadata ?? {};
    const headers = sanitizeHeaders(req.headers);
    const subjectFromHeader = extractSubjectFromHeaders(req.headers);
    const explicitSubject = parsed.subjectId ?? subjectFromHeader;
    const maskedSubject = maskSubjectId(explicitSubject ?? "");

    if (shouldDebugToolCalls()) {
      logger.debug("tool request metadata", {
        tool: toolName,
        subject: maskedSubject,
        metadata,
        headers
      });
    }

    const result = await executeToolByName(toolName, parsed.input ?? {}, {
      metadata: {
        ...metadata,
        headers
      },
      subjectId: explicitSubject
    });

    sendJson(res, 200, { ok: true, result });
  } catch (error) {
    logger.error("tool invocation failed", {
      tool: toolName,
      error: error instanceof Error ? error.message : error
    });
    sendJson(res, 400, {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

export const startSseServer = (options: SseServerOptions = {}) => {
  const port = options.port ?? config.sse.port;
  const host = options.host ?? config.sse.host;
  const path = options.path ?? config.sse.path;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "GET" && url.pathname === path) {
      logger.info("SSE connection established", {});
      handleSseHandshake(res);
      req.on("close", () => {
        logger.info("SSE connection closed", {});
      });
      return;
    }

    if (req.method === "POST" && url.pathname.startsWith("/mcp/tools/")) {
      const toolName = url.pathname.replace("/mcp/tools/", "");
      await handleToolInvocation(req, res, toolName);
      return;
    }

    if (req.method === "GET" && url.pathname === "/healthz") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    sendJson(res, 404, { ok: false, error: "Not Found" });
  });

  server.listen(port, host, () => {
    logger.info("MCP SSE server listening", {
      host,
      port,
      path,
      env: config.nodeEnv,
      tools: getToolCatalog().map((tool) => tool.name)
    });
  });

  return server;
};
