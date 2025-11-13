import http from "node:http";
import { URL } from "node:url";

import { config } from "../config";
import { logger } from "../logger";
import { getToolCatalog } from "../toolRegistry";

export interface StreamingServerOptions {
  port?: number;
  host?: string;
  path?: string;
}

export const startStreamingServer = (options: StreamingServerOptions = {}) => {
  const port = options.port ?? config.streaming.port;
  const host = options.host ?? config.streaming.host;
  const path = options.path ?? config.streaming.path;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "GET" && url.pathname === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "POST" && url.pathname === path) {
      res.writeHead(501, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          message:
            "Streaming/WebRTC transport is not implemented yet. Tools are registered and ready for future integration.",
          tools: getToolCatalog().map((tool) => tool.name)
        })
      );
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Not Found" }));
  });

  server.listen(port, host, () => {
    logger.info("Streaming placeholder listening", {
      host,
      port,
      path,
      env: config.nodeEnv
    });
  });

  return server;
};
