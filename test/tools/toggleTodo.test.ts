import { beforeEach, describe, expect, it } from "vitest";

import { TodoNotFoundError } from "../../src/errors";
import { createToggleTodoTool } from "../../src/tools/toggleTodo";
import { createTestContext, createTestStore } from "../helpers/toolkit";

describe("toggle_todo tool", () => {
  const context = createTestContext();
  let store = createTestStore();
  let tool = createToggleTodoTool(store);
  let todoId = "";

  beforeEach(async () => {
    store = createTestStore();
    tool = createToggleTodoTool(store);
    const todo = await store.createTodo(context.subjectId, { title: "Toggle me" });
    todoId = todo.id;
  });

  it("toggles between pending and done", async () => {
    const result = await tool.handler({ todoId }, context);
    expect(result.todo.status).toBe("done");

    const second = await tool.handler({ todoId }, context);
    expect(second.todo.status).toBe("pending");
  });

  it("throws for unknown todos", async () => {
    await expect(tool.handler({ todoId: "missing" }, context)).rejects.toBeInstanceOf(
      TodoNotFoundError
    );
  });
});
