import { beforeEach, describe, expect, it } from "vitest";

import { TodoNotFoundError } from "@/errors";
import { createDeleteTodoTool } from "@/tools/deleteTodo";
import { createTestContext, createTestStore } from "../helpers/toolkit";

describe("delete_todo tool", () => {
  const context = createTestContext();
  let store = createTestStore();
  let tool = createDeleteTodoTool(store);
  let todoId = "";

  beforeEach(async () => {
    store = createTestStore();
    tool = createDeleteTodoTool(store);
    todoId = (await store.createTodo(context.subjectId, { title: "Remove me" })).id;
  });

  it("removes the todo", async () => {
    const result = await tool.handler({ todoId }, context);
    expect(result.success).toBe(true);
    const remaining = await store.getTodosBySubject(context.subjectId);
    expect(remaining).toHaveLength(0);
  });

  it("throws when todo does not exist", async () => {
    await expect(tool.handler({ todoId: "nope" }, context)).rejects.toBeInstanceOf(
      TodoNotFoundError
    );
  });
});
