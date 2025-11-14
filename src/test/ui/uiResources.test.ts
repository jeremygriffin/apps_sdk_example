import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockConfig = {
  ui: {
    enabled: true,
    distPath: "",
    indexHtmlPath: "",
    mountPath: "/todo-ui",
    publicBaseUrl: "https://example.com/todo-ui",
    resourceUri: "ui://todo/board",
    resourceName: "Todo board",
    resourceDescription: "desc",
    toolInvocation: {
      invoking: "Opening board",
      invoked: "Board ready"
    },
    assetsAvailable: true
  }
};

vi.mock("@/config", () => ({
  config: mockConfig
}));

let loadTodoUiHtml: typeof import("@/ui/uiResources").loadTodoUiHtml;
let getTodoUiResourceDescriptor: typeof import("@/ui/uiResources").getTodoUiResourceDescriptor;
let getTodoUiWidgetMeta: typeof import("@/ui/uiResources").getTodoUiWidgetMeta;

beforeAll(async () => {
  const module = await import("@/ui/uiResources");
  loadTodoUiHtml = module.loadTodoUiHtml;
  getTodoUiResourceDescriptor = module.getTodoUiResourceDescriptor;
  getTodoUiWidgetMeta = module.getTodoUiWidgetMeta;
});

describe("todo ui resources", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "todo-ui-"));
    mockConfig.ui.distPath = tempDir;
    mockConfig.ui.indexHtmlPath = path.join(tempDir, "index.html");
    fs.writeFileSync(
      mockConfig.ui.indexHtmlPath,
      '<script type="module" src="/assets/main.js"></script><link rel="stylesheet" href="/assets/main.css" />',
      "utf-8"
    );
    mockConfig.ui.enabled = true;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("rewrites asset paths when loading html", () => {
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
    const html = loadTodoUiHtml(loggerStub as any);

    expect(html).toContain('src="https://example.com/todo-ui/assets/main.js"');
    expect(html).toContain('href="https://example.com/todo-ui/assets/main.css"');
  });

  it("returns widget metadata when enabled", () => {
    const meta = getTodoUiWidgetMeta();
    expect(meta).toMatchObject({
      "openai/outputTemplate": "ui://todo/board"
    });
  });

  it("skips metadata when disabled", () => {
    mockConfig.ui.enabled = false;
    expect(getTodoUiWidgetMeta()).toBeUndefined();
  });

  it("exposes descriptor for list resources", () => {
    const descriptor = getTodoUiResourceDescriptor();
    expect(descriptor.uri).toBe("ui://todo/board");
    expect(descriptor.mimeType).toBe("text/html+skybridge");
  });
});
