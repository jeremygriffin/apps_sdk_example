import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";

import { createLogger } from "../../logger";
import { wireLoggingCapability } from "../../mcp/createServer";

const createStubServer = () => {
  let handler: ((request: { params: { level: string } }) => Promise<unknown> | unknown) | undefined;
  const notification = vi.fn().mockResolvedValue(undefined);
  const registerCapabilities = vi.fn();
  const assertHandler = vi.fn();
  const stub = {
    server: {
      registerCapabilities,
      assertCanSetRequestHandler: assertHandler,
      setRequestHandler: vi.fn((_schema, cb) => {
        handler = cb;
      }),
      notification
    },
    close: vi.fn(async () => {})
  } as unknown as McpServer;

  return {
    stub,
    notification,
    registerCapabilities,
    getHandler: () => handler
  };
};

describe("wireLoggingCapability", () => {
  it("registers the logging capability and updates levels on request", async () => {
    const { stub, registerCapabilities, getHandler } = createStubServer();
    const log = createLogger("info", () => {});

    wireLoggingCapability(stub, log);

    expect(registerCapabilities).toHaveBeenCalledWith({ logging: {} });
    const handler = getHandler();
    expect(handler).toBeDefined();

    await handler!({ params: { level: "debug" } });
    expect(log.getLevel()).toBe("debug");

    await expect(handler!({ params: { level: "verbose" } })).rejects.toThrow(
      /Unsupported log level/
    );
  });

  it("forwards log events as notifications", () => {
    const { stub, notification } = createStubServer();
    const log = createLogger("info", () => {});

    wireLoggingCapability(stub, log);
    log.info("unit", { foo: "bar" });

    expect(notification).toHaveBeenCalledWith({
      method: "notifications/message",
      params: {
        level: "info",
        logger: "unit",
        data: { foo: "bar" }
      }
    });
  });

  it("filters notifications according to the active log level", async () => {
    const { stub, notification, getHandler } = createStubServer();
    const log = createLogger("info", () => {});

    wireLoggingCapability(stub, log);
    const handler = getHandler();
    await handler!({ params: { level: "error" } });
    log.info("unit");
    expect(notification).not.toHaveBeenCalled();

    log.error("unit");
    expect(notification).toHaveBeenCalledWith({
      method: "notifications/message",
      params: {
        level: "error",
        logger: "unit",
        data: {}
      }
    });
  });
});
