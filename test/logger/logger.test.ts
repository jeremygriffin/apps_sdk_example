import { describe, expect, it } from "vitest";

import { createLogger, maskSubjectId } from "../../src/logger";

describe("logger", () => {
  it("respects the configured log level", () => {
    const entries: string[] = [];
    const logger = createLogger({
      level: "warn",
      sink: ({ level, message }) => entries.push(`${level}:${message}`)
    });

    logger.debug("ignored");
    logger.info("also ignored");
    logger.warn("pay attention");
    logger.error("boom");

    expect(entries).toEqual(["warn:pay attention", "error:boom"]);
  });

  it("masks subject identifiers", () => {
    expect(maskSubjectId("user_1234567890abcdef")).toBe("user...cdef");
    expect(maskSubjectId("abc"))
      .toMatch(/^a\*\*\*[a-z0-9]$/i);
  });

  it("never throws even if the sink misbehaves", () => {
    const logger = createLogger({
      level: "debug",
      sink: () => {
        throw new Error("boom");
      }
    });

    expect(() => logger.info("still safe", { foo: "bar" })).not.toThrow();
  });
});
