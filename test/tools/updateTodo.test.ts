import { beforeEach, describe, expect, it } from "vitest";

import { TodoNotFoundError } from "../../src/errors";
import { createUpdateTodoTool } from "../../src/tools/updateTodo";
import { createTestContext, createTestStore } from "../helpers/toolkit";

describe("update_todo tool", () => {
  const context = createTestContext();
  let store = createTestStore();
  let tool = createUpdateTodoTool(store);
  let todoId = "";

  beforeEach(async () => {
    store = createTestStore();
    tool = createUpdateTodoTool(store);
    todoId = (await store.createTodo(context.subjectId, { title: "Original" })).id;
  });

  it("updates provided fields", async () => {
    const result = await tool.handler(
      {
        todoId,
        title: "Renamed",
        status: "in_progress"
      },
      context
    );
    expect(result.todo.title).toBe("Renamed");
    expect(result.todo.status).toBe("in_progress");
  });

  it("requires at least one field", () => {
    expect(() => tool.inputSchema.parse({ todoId })).toThrow();
  });

  it("throws when todo missing", async () => {
    await expect(
      tool.handler(
        {
          todoId: "missing",
          title: "nope"
        },
        context
      )
    ).rejects.toBeInstanceOf(TodoNotFoundError);
  });
});
