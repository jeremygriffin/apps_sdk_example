import http, { request } from "node:http";
import { once } from "node:events";
import { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { config } from "../../src/config";
import { createLogger } from "../../src/logger";
import { startUnifiedServer } from "../../src/servers/unifiedServer";

const connect = async () => {
  const server = startUnifiedServer({ host: "127.0.0.1", port: 0, logger: createLogger("error") });
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
});
