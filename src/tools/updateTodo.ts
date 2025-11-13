import { z } from "zod";

import { logger, maskSubjectId } from "../logger";
import { Store } from "../storage";
import { TodoSchema } from "../types/todo";
import { ToolDefinition } from "../types/tool";

const InputSchema = z
  .object({
    todoId: z.string().min(1, "todoId is required"),
    title: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(["pending", "in_progress", "done"]).optional()
  })
  .refine(
    (value) => value.title !== undefined || value.notes !== undefined || value.status !== undefined,
    {
      message: "At least one field must be provided to update."
    }
  );

const OutputSchema = z.object({
  todo: TodoSchema
});

export const createUpdateTodoTool = (
  store: Store
): ToolDefinition<typeof InputSchema, typeof OutputSchema> => ({
  name: "update_todo",
  description: "Update title, notes, or status of a todo for the current user.",
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  handler: async (input, ctx) => {
    const { todoId, title, notes, status } = input;
    const todo = await store.updateTodo(ctx.subjectId, todoId, {
      title,
      notes,
      status
    });
    logger.info("update_todo applied", {
      subject: maskSubjectId(ctx.subjectId),
      todoId: todo.id,
      status: todo.status
    });
    return { todo };
  }
});
