import { z } from "zod";

import { TodoNotFoundError } from "@/errors";
import { maskSubjectId, shouldDebugToolCalls } from "@/logger";
import { Store } from "@/storage";
import { TodoSchema } from "@/types/todo";
import { ToolDefinition } from "@/types/tool";
import { nowIsoString } from "@/utils/datetime";

const InputSchema = z.object({
  todoId: z.string().min(1, "todoId is required")
});

const OutputSchema = z.object({
  todo: TodoSchema
});

const buildLinks = (title: string) => [
  {
    label: "Background reading",
    url: `https://example.com/search?q=${encodeURIComponent(title)}`
  },
  {
    label: "Productivity tips",
    url: "https://example.com/productivity"
  }
];

export const createEnrichTodoTool = (
  store: Store
): ToolDefinition<typeof InputSchema, typeof OutputSchema> => ({
  name: "enrich_todo",
  description:
    "Simulate AI enrichment for a todo item (e.g., adding summary and related links).",
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  handler: async (input, ctx) => {
    const existing = await store.getTodoById(ctx.subjectId, input.todoId, ctx.logger);
    if (!existing) {
      throw new TodoNotFoundError(ctx.subjectId, input.todoId);
    }
    const runAt = nowIsoString();
    const summary = `This is a simulated summary for: ${existing.title}`;
    const todo = await store.updateTodoEnrichment(
      ctx.subjectId,
      input.todoId,
      {
        status: "complete",
        summary,
        links: buildLinks(existing.title),
        lastRunAt: runAt
      },
      ctx.logger
    );
    ctx.logger.info("enrich_todo completed", {
      subject: maskSubjectId(ctx.subjectId),
      todoId: todo.id
    });
    if (shouldDebugToolCalls(ctx.logger)) {
      ctx.logger.debug("enrich_todo payload", {
        subject: maskSubjectId(ctx.subjectId),
        todo
      });
    }
    return { todo };
  }
});
