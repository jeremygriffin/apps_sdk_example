import { beforeEach, describe, expect, it } from "vitest";

import { createCreateTodoTool } from "@/tools/createTodo";
import { createTestContext, createTestStore } from "../helpers/toolkit";

describe("create_todo tool", () => {
  const context = createTestContext();
  let store = createTestStore();
  let tool = createCreateTodoTool(store);

  beforeEach(() => {
    store = createTestStore();
    tool = createCreateTodoTool(store);
  });

  it("creates todos with default state", async () => {
    const result = await tool.handler({ title: "New task" }, context);
    expect(result.todo.title).toBe("New task");
    expect(result.todo.status).toBe("pending");
    expect(result.todo.aiEnrichmentStatus).toBe("not_started");
  });

  it("fails validation when title missing", () => {
    expect(() => tool.inputSchema.parse({ title: "" })).toThrow();
  });
});
