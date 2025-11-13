import { z } from "zod";

import { logger, maskSubjectId } from "../logger";
import { Store } from "../storage";
import { TodoSchema } from "../types/todo";
import { ToolDefinition } from "../types/tool";

const InputSchema = z.object({
  todoId: z.string().min(1, "todoId is required")
});

const OutputSchema = z.object({
  todo: TodoSchema
});

export const createToggleTodoTool = (
  store: Store
): ToolDefinition<typeof InputSchema, typeof OutputSchema> => ({
  name: "toggle_todo",
  description: "Toggle the completion status of a todo for the current user.",
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  handler: async (input, ctx) => {
    const todo = await store.toggleTodoStatus(ctx.subjectId, input.todoId);
    logger.info("toggle_todo updated", {
      subject: maskSubjectId(ctx.subjectId),
      todoId: todo.id,
      status: todo.status
    });
    return { todo };
  }
});
