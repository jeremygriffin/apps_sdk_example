import { describe, expect, it } from "vitest";

import { maskSubjectId } from "@/logger";
import { sanitizeStructuredContent } from "@/utils/sanitize";

describe("sanitizeStructuredContent", () => {
  it("masks top-level subject identifiers", () => {
    const input = { subjectId: "super-secret-subject" };
    const result = sanitizeStructuredContent(input) as Record<string, unknown>;

    expect(result.subjectId).toBe(maskSubjectId("super-secret-subject"));
  });

  it("masks nested subject fields inside arrays", () => {
    const input = {
      todos: [
        { subjectId: "nested-subject", title: "todo" },
        { subjectId: "nested-two", title: "todo 2" }
      ]
    };

    const result = sanitizeStructuredContent(input) as {
      todos: Array<Record<string, unknown>>;
    };

    expect(result.todos[0].subjectId).toBe(maskSubjectId("nested-subject"));
    expect(result.todos[1].subjectId).toBe(maskSubjectId("nested-two"));
  });
});
