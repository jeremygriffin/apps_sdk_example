import http, { request } from "node:http";
import { once } from "node:events";
import { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { config } from "../../src/config";
import { createLogger, LogEvent, Logger } from "../../src/logger";
import { startUnifiedServer } from "../../src/servers/unifiedServer";

const assetTest = config.ui.enabled ? test : test.skip;

const connect = async (logger: Logger = createLogger("error")) => {
  const server = startUnifiedServer({ host: "127.0.0.1", port: 0, logger });
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://${address.address}:${address.port}`;
  return { server, baseUrl };
};

describe("unified server", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const handle = await connect();
    server = handle.server;
    baseUrl = handle.baseUrl;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  });

  test("responds to health checks", async () => {
    await new Promise<void>((resolve, reject) => {
      http.get(`${baseUrl}/healthz`, (res) => {
        expect(res.statusCode).toBe(200);
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () => {
          const payload = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
          expect(payload.ok).toBe(true);
          resolve();
        });
      }).on("error", reject);
    });
  });

  test("accepts SSE connections", async () => {
    await new Promise<void>((resolve, reject) => {
      const req = http.get(`${baseUrl}${config.server.ssePath}`, (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers["content-type"]).toContain("text/event-stream");
        res.destroy();
        resolve();
      });
      req.on("error", reject);
    });
  });

  test("rejects invalid streaming initialization", async () => {
    await new Promise<void>((resolve, reject) => {
      const req = request(
        `${baseUrl}${config.server.streamPath}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          }
        },
        (res) => {
          expect(typeof res.statusCode).toBe("number");
          expect((res.statusCode as number) >= 400).toBe(true);
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk as Buffer));
          res.on("end", () => {
            expect(chunks.length).toBeGreaterThan(0);
            resolve();
          });
        }
      );
      req.on("error", reject);
      req.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            implementation: { name: "test-server", version: "0.0.0" },
            clientInfo: { name: "unified-server-test", version: "0.0.0" }
          }
        })
      );
      req.end();
    });
  });

  test("logs request metadata in debug mode", async () => {
    const events: LogEvent[] = [];
    const debugLogger = createLogger("debug", (event) => {
      events.push(event);
    });
    const { server: debugServer, baseUrl: debugBaseUrl } = await connect(debugLogger);

    await new Promise<void>((resolve, reject) => {
      const req = request(
        `${debugBaseUrl}/healthz?foo=bar&foo=baz&single=value`,
        {
          method: "GET",
          headers: {
            authorization: "Bearer secret-token",
            "x-custom-header": "ok"
          }
        },
        (res) => {
          res.resume();
          res.on("end", resolve);
        }
      );
      req.on("error", reject);
      req.end();
    });

    await new Promise<void>((resolve, reject) => {
      debugServer.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    const requestEvent = events.find((event) => event.logger === "http.request");
    expect(requestEvent).toBeDefined();
    expect(requestEvent?.data?.path).toBe("/healthz");
    expect(requestEvent?.data?.method).toBe("GET");

    const headers = requestEvent?.data?.headers as Record<string, unknown>;
    expect(headers["authorization"]).toBe("[REDACTED]");
    expect(headers["x-custom-header"]).toBe("ok");

    const query = requestEvent?.data?.query as Record<string, unknown>;
    expect(query["single"]).toBe("value");
    expect(query["foo"]).toEqual(["bar", "baz"]);

    const responseEvent = events.find((event) => event.logger === "http.response");
    expect(responseEvent).toBeDefined();
    expect(responseEvent?.data?.path).toBe("/healthz");
    expect(responseEvent?.data?.status).toBe(200);
    expect(typeof responseEvent?.data?.durationMs).toBe("number");
    expect(responseEvent?.data?.aborted).toBeUndefined();
  });

  assetTest("serves todo ui assets with cors headers", async () => {
    await new Promise<void>((resolve, reject) => {
      http.get(`${baseUrl}${config.ui.mountPath}/index.html`, (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers["access-control-allow-origin"]).toBe("*");
        expect(res.headers["access-control-allow-methods"]).toContain("GET");
        res.resume();
        res.on("end", resolve);
      }).on("error", reject);
    });
  });

  assetTest("responds to todo ui asset preflight requests", async () => {
    await new Promise<void>((resolve, reject) => {
      const req = request(
        `${baseUrl}${config.ui.mountPath}/index.html`,
        { method: "OPTIONS" },
        (res) => {
          expect(res.statusCode).toBe(204);
          expect(res.headers["access-control-allow-origin"]).toBe("*");
          expect(res.headers["access-control-allow-methods"]).toContain("OPTIONS");
          res.resume();
          res.on("end", resolve);
        }
      );
      req.on("error", reject);
      req.end();
    });
  });

  assetTest("emits logs for todo ui asset requests", async () => {
    const events: LogEvent[] = [];
    const assetLogger = createLogger("debug", (event) => {
      events.push(event);
    });
    const { server: assetServer, baseUrl: assetBase } = await connect(assetLogger);

    await new Promise<void>((resolve, reject) => {
      http.get(`${assetBase}${config.ui.mountPath}/index.html`, (res) => {
        res.resume();
        res.on("end", resolve);
      }).on("error", reject);
    });

    await new Promise<void>((resolve, reject) => {
      assetServer.close((error) => (error ? reject(error) : resolve()));
    });

    const assetEvent = events.find((event) => event.logger === "todo.ui.asset");
    expect(assetEvent).toBeDefined();
    expect(assetEvent?.data?.status).toBe(200);
    expect(assetEvent?.data?.asset).toBe("index.html");
  });
});
