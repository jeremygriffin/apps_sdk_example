import { z } from "zod";

export const TodoStatusSchema = z.enum(["pending", "in_progress", "done"]);
export type TodoStatus = z.infer<typeof TodoStatusSchema>;

export const AiEnrichmentStatusSchema = z.enum([
  "not_started",
  "queued",
  "running",
  "complete",
  "error"
]);
export type AiEnrichmentStatus = z.infer<typeof AiEnrichmentStatusSchema>;

export const AiLinkSchema = z.object({
  label: z.string().min(1, "Label is required"),
  url: z.string().url("URL must be valid")
});
export type AiLink = z.infer<typeof AiLinkSchema>;

export const TodoSchema = z.object({
  id: z.string(),
  subjectId: z.string(),
  title: z.string().min(1, "Title is required"),
  notes: z.string().optional(),
  status: TodoStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  aiEnrichmentStatus: AiEnrichmentStatusSchema,
  aiSummary: z.string().optional(),
  aiLinks: z.array(AiLinkSchema).optional(),
  aiLastRunAt: z.string().datetime().optional()
});

export type Todo = z.infer<typeof TodoSchema>;

export type TodoUpdateFields = Partial<Pick<Todo, "title" | "notes" | "status">>;
