import { beforeEach, describe, expect, it } from "vitest";

import { createListTodosTool } from "@/tools/listTodos";
import { createTestContext, createTestStore, TEST_SUBJECT_ID } from "../helpers/toolkit";

describe("list_todos tool", () => {
  const context = createTestContext();
  const otherCtx = createTestContext("other-subject");
  let store = createTestStore();
  let tool = createListTodosTool(store);

  beforeEach(async () => {
    store = createTestStore();
    tool = createListTodosTool(store);
    await store.createTodo(TEST_SUBJECT_ID, { title: "First" });
    await store.createTodo(TEST_SUBJECT_ID, { title: "Second" });
    await store.createTodo(otherCtx.subjectId, { title: "Hidden" });
  });

  it("returns only todos owned by the context subject", async () => {
    const result = await tool.handler({}, context);
    expect(result.todos).toHaveLength(2);
    expect(result.todos.every((todo) => todo.subjectId === TEST_SUBJECT_ID)).toBe(true);
  });
});
