import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { loadRuntimeConfig } from "../../src/configLoader";

describe("runtime config loader", () => {
  const createEnvFile = (values: Record<string, string>) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "config-test-"));
    const filePath = path.join(dir, "env.json");
    fs.writeFileSync(filePath, JSON.stringify(values));
    return filePath;
  };

  test("uses defaults when no env present", () => {
    const cfg = loadRuntimeConfig({ env: {}, envFilePath: path.join(os.tmpdir(), "non-existent.json") });
    expect(cfg.server.port).toBe(3001);
    expect(cfg.server.host).toBe("0.0.0.0");
    expect(cfg.server.ssePath).toBe("/mcp/sse");
    expect(cfg.server.streamPath).toBe("/mcp/stream");
    expect(cfg.subjectMetadataKeys).toEqual(["openai/subject", "subjectId"]);
  });

  test("loads values from env file", () => {
    const envPath = createEnvFile({
      SERVER_PORT: "4100",
      SERVER_HOST: "127.0.0.1",
      SSE_PATH: "/custom/sse",
      SUBJECT_METADATA_KEYS: "foo,bar"
    });

    const cfg = loadRuntimeConfig({ env: {}, envFilePath: envPath });

    expect(cfg.server.port).toBe(4100);
    expect(cfg.server.host).toBe("127.0.0.1");
    expect(cfg.server.ssePath).toBe("/custom/sse");
    expect(cfg.subjectMetadataKeys).toEqual(["foo", "bar"]);
  });

  test("prefers process env over env file", () => {
    const envPath = createEnvFile({ SERVER_PORT: "4100" });

    const cfg = loadRuntimeConfig({ env: { SERVER_PORT: "5100" }, envFilePath: envPath });

    expect(cfg.server.port).toBe(5100);
  });

  test("throws when env file contains invalid json", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "config-test-"));
    const envPath = path.join(dir, "env.json");
    fs.writeFileSync(envPath, "{ invalid");

    expect(() => loadRuntimeConfig({ env: {}, envFilePath: envPath })).toThrow(SyntaxError);
  });
});
