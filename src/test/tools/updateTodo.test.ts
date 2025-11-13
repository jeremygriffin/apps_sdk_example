import { beforeEach, describe, expect, it } from "vitest";

import { TodoNotFoundError } from "../../errors";
import { createUpdateTodoTool } from "../../tools/updateTodo";
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

  it("updates annotations when provided", async () => {
    const result = await tool.handler(
      {
        todoId,
        priority: 4,
        complexity: 2,
        marker: "triangle"
      },
      context
    );
    expect(result.todo.priority).toBe(4);
    expect(result.todo.complexity).toBe(2);
    expect(result.todo.marker).toBe("triangle");
  });

  it("validates annotation ranges and marker options", () => {
    expect(() =>
      tool.inputSchema.parse({
        todoId,
        priority: 9
      })
    ).toThrow();

    expect(() =>
      tool.inputSchema.parse({
        todoId,
        complexity: 0
      })
    ).toThrow();

    expect(() =>
      tool.inputSchema.parse({
        todoId,
        marker: "hexagon"
      })
    ).toThrow();
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
