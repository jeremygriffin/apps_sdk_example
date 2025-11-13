import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";

import { createLogger } from "../../src/logger";
import { wireLoggingCapability } from "../../src/mcp/createServer";

const createStubServer = () => {
  let handler: ((request: { params: { level: string } }) => Promise<unknown> | unknown) | undefined;
  const sendNotification = vi.fn();
  const registerCapabilities = vi.fn();
  const assertHandler = vi.fn();
  const stub = {
    server: {
      registerCapabilities,
      assertCanSetRequestHandler: assertHandler,
      setRequestHandler: vi.fn((_schema, cb) => {
        handler = cb;
      }),
      sendNotification
    },
    close: vi.fn(async () => {})
  } as unknown as McpServer;

  return {
    stub,
    sendNotification,
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
    const { stub, sendNotification } = createStubServer();
    const log = createLogger("info", () => {});

    wireLoggingCapability(stub, log);
    log.info("unit", { foo: "bar" });

    expect(sendNotification).toHaveBeenCalledWith("notifications/message", {
      level: "info",
      logger: "unit",
      data: { foo: "bar" }
    });
  });

  it("filters notifications according to the active log level", async () => {
    const { stub, sendNotification, getHandler } = createStubServer();
    const log = createLogger("info", () => {});

    wireLoggingCapability(stub, log);
    const handler = getHandler();
    await handler!({ params: { level: "error" } });
    log.info("unit");
    expect(sendNotification).not.toHaveBeenCalled();

    log.error("unit");
    expect(sendNotification).toHaveBeenCalledWith("notifications/message", {
      level: "error",
      logger: "unit",
      data: {}
    });
  });
});
