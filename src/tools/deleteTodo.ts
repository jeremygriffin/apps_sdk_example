import { z } from "zod";

import { logger, maskSubjectId } from "../logger";
import { Store } from "../storage";
import { ToolDefinition } from "../types/tool";

const InputSchema = z.object({
  todoId: z.string().min(1, "todoId is required")
});

const OutputSchema = z.object({
  success: z.literal(true)
});

export const createDeleteTodoTool = (
  store: Store
): ToolDefinition<typeof InputSchema, typeof OutputSchema> => ({
  name: "delete_todo",
  description: "Delete a todo for the current user.",
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  handler: async (input, ctx) => {
    await store.deleteTodo(ctx.subjectId, input.todoId);
    logger.info("delete_todo removed", {
      subject: maskSubjectId(ctx.subjectId),
      todoId: input.todoId
    });
    return { success: true };
  }
});
