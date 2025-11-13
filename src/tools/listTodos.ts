import { z } from "zod";

import { logger, maskSubjectId, shouldDebugToolCalls } from "../logger";
import { Store } from "../storage";
import { TodoSchema } from "../types/todo";
import { ToolDefinition } from "../types/tool";

const InputSchema = z.object({});
const OutputSchema = z.object({
  todos: z.array(TodoSchema)
});

export const createListTodosTool = (
  store: Store
): ToolDefinition<typeof InputSchema, typeof OutputSchema> => ({
  name: "list_todos",
  description: "List all todos for the current user.",
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  handler: async (_input, ctx) => {
    const todos = await store.getTodosBySubject(ctx.subjectId);
    if (shouldDebugToolCalls()) {
      logger.debug("list_todos payload", {
        subject: maskSubjectId(ctx.subjectId),
        todos
      });
    } else {
      logger.info("list_todos invoked", {
        subject: maskSubjectId(ctx.subjectId),
        count: todos.length
      });
    }
    return { todos };
  }
});
