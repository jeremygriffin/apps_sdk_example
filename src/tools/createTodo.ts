import { z } from "zod";

import { maskSubjectId, shouldDebugToolCalls } from "@/logger";
import { Store } from "@/storage";
import { TodoSchema } from "@/types/todo";
import { ToolDefinition } from "@/types/tool";

const InputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  notes: z.string().optional()
});

const OutputSchema = z.object({
  todo: TodoSchema
});

export const createCreateTodoTool = (
  store: Store
): ToolDefinition<typeof InputSchema, typeof OutputSchema> => ({
  name: "create_todo",
  description: "Create a new todo for the current user.",
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  handler: async (input, ctx) => {
    const todo = await store.createTodo(
      ctx.subjectId,
      {
        title: input.title,
        notes: input.notes
      },
      ctx.logger
    );
    ctx.logger.info("create_todo completed", {
      subject: maskSubjectId(ctx.subjectId),
      todoId: todo.id
    });
    if (shouldDebugToolCalls(ctx.logger)) {
      ctx.logger.debug("create_todo payload", {
        subject: maskSubjectId(ctx.subjectId),
        todo
      });
    }
    return { todo };
  }
});
