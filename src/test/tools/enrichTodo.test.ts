import { beforeEach, describe, expect, it } from "vitest";

import { TodoNotFoundError } from "@/errors";
import { createEnrichTodoTool } from "@/tools/enrichTodo";
import { createTestContext, createTestStore } from "../helpers/toolkit";

describe("enrich_todo tool", () => {
  const context = createTestContext();
  let store = createTestStore();
  let tool = createEnrichTodoTool(store);
  let todoId = "";

  beforeEach(async () => {
    store = createTestStore();
    tool = createEnrichTodoTool(store);
    todoId = (await store.createTodo(context.subjectId, { title: "Enrich me" })).id;
  });

  it("fills enrichment fields with simulated data", async () => {
    const result = await tool.handler({ todoId }, context);
    expect(result.todo.aiEnrichmentStatus).toBe("complete");
    expect(result.todo.aiSummary).toContain("Enrich me");
    expect(result.todo.aiLinks?.length).toBeGreaterThanOrEqual(1);
    expect(result.todo.aiLastRunAt).toBeTruthy();
  });

  it("throws if todo missing", async () => {
    await expect(tool.handler({ todoId: "unknown" }, context)).rejects.toBeInstanceOf(
      TodoNotFoundError
    );
  });
});
