import { describe, expect, it, vi } from "vitest";

import { registerResourcesWithServer } from "@/mcp/registerResources";

const mockDescriptor = {
  uri: "ui://todo/board",
  name: "Todo board",
  description: "desc",
  mimeType: "text/html+skybridge",
  _meta: {}
};

vi.mock("@/ui/uiResources", () => ({
  isTodoUiEnabled: () => true,
  getTodoUiResourceDescriptor: () => mockDescriptor,
  getTodoUiWidgetMeta: () => ({ "openai/outputTemplate": mockDescriptor.uri }),
  getTodoUiMimeType: () => mockDescriptor.mimeType,
  loadTodoUiHtml: vi.fn().mockReturnValue("<html></html>")
}));

const createStubServer = () => {
  const registerCapabilities = vi.fn();
  const assertCanSetRequestHandler = vi.fn();
  const setRequestHandler = vi.fn();
  const server = {
    server: {
      registerCapabilities,
      assertCanSetRequestHandler,
      setRequestHandler
    }
  } as any;
  return { server, registerCapabilities, assertCanSetRequestHandler, setRequestHandler };
};

describe("registerResourcesWithServer", () => {
  it("registers list/read handlers for the todo ui resource", () => {
    const { server, registerCapabilities, assertCanSetRequestHandler, setRequestHandler } =
      createStubServer();

    const loggerStub = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      sendLogMessage: () => {},
      getLevel: () => "info" as const,
      setLevel: () => {},
      child: () => loggerStub
    };

    registerResourcesWithServer(server, loggerStub as any);

    expect(registerCapabilities).toHaveBeenCalledWith({
      resources: { subscribe: true }
    });
    expect(assertCanSetRequestHandler).toHaveBeenCalledTimes(3);
    expect(setRequestHandler).toHaveBeenCalledTimes(3);

    const readHandler = setRequestHandler.mock.calls[2]?.[1];
    const result = readHandler();
    expect(result.contents[0]).toMatchObject({
      uri: mockDescriptor.uri,
      mimeType: mockDescriptor.mimeType
    });
  });
});
