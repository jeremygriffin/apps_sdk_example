import { describe, expect, it, vi } from "vitest";

import { createLogger, LogLevel, maskSubjectId } from "../../src/logger";

describe("logger", () => {
  it("filters messages below the configured level", () => {
    const entries: Array<{ level: LogLevel; logger: string }> = [];
    const log = createLogger("warning", (event) => {
      entries.push({ level: event.level, logger: event.logger });
    });

    log.debug("unit");
    log.info("unit");
    log.notice("unit");
    log.warn("unit-warning");
    log.error("unit-error");

    expect(entries).toEqual([
      { level: "warning", logger: "unit-warning" },
      { level: "error", logger: "unit-error" }
    ]);
  });

  it("validates levels when setLevel is called", () => {
    const entries: LogLevel[] = [];
    const log = createLogger("error", (event) => entries.push(event.level));

    log.setLevel("debug");
    log.debug("unit");
    expect(entries).toEqual(["debug"]);

    expect(() => log.setLevel("verbose" as LogLevel)).toThrow(/Unsupported log level/);
  });

  it("produces JSON console output", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const log = createLogger("info");

    try {
      log.info("unit", { foo: "bar" });

      expect(infoSpy).toHaveBeenCalledTimes(1);
      const payload = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(payload);
      expect(parsed.level).toBe("info");
      expect(parsed.logger).toBe("unit");
      expect(parsed.data).toEqual({ foo: "bar" });
      expect(typeof parsed.timestamp).toBe("string");
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("masks subject identifiers", () => {
    expect(maskSubjectId("user_1234567890abcdef")).toBe("user...cdef");
    expect(maskSubjectId("abc")).toMatch(/^a\*\*\*[a-z0-9]$/i);
  });

  it("never throws even if the sink misbehaves", () => {
    const log = createLogger("debug", () => {
      throw new Error("boom");
    });

    expect(() => log.info("still safe", { foo: "bar" })).not.toThrow();
  });
});
