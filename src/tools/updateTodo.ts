import { z } from "zod";

import { maskSubjectId } from "@/logger";
import { Store } from "@/storage";
import { TodoMarkerSchema, TodoSchema } from "@/types/todo";
import { ToolDefinition } from "@/types/tool";

const InputSchema = z
  .object({
    todoId: z.string().min(1, "todoId is required"),
    title: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(["pending", "in_progress", "done"]).optional(),
    priority: z.number().int().min(1).max(5).optional(),
    complexity: z.number().int().min(1).max(3).optional(),
    marker: TodoMarkerSchema.optional()
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.notes !== undefined ||
      value.status !== undefined ||
      value.priority !== undefined ||
      value.complexity !== undefined ||
      value.marker !== undefined,
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
  description:
    "Update title, notes, status, or annotation fields (priority, complexity, marker) of a todo.",
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  handler: async (input, ctx) => {
    const { todoId, title, notes, status, priority, complexity, marker } = input;
    const todo = await store.updateTodo(
      ctx.subjectId,
      todoId,
      {
        title,
        notes,
        status,
        priority,
        complexity,
        marker
      },
      ctx.logger
    );
    ctx.logger.info("update_todo applied", {
      subject: maskSubjectId(ctx.subjectId),
      todoId: todo.id,
      status: todo.status,
      priority: todo.priority,
      complexity: todo.complexity,
      marker: todo.marker
    });
    return { todo };
  }
});
