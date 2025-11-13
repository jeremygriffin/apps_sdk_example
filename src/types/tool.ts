import { z, ZodTypeAny } from "zod";

export interface ToolContext {
  subjectId: string;
  metadata?: Record<string, unknown>;
}

export interface ToolDefinition<
  InputSchema extends ZodTypeAny,
  OutputSchema extends ZodTypeAny
> {
  name: string;
  description: string;
  inputSchema: InputSchema;
  outputSchema: OutputSchema;
  handler: (
    input: z.infer<InputSchema>,
    ctx: ToolContext
  ) => Promise<z.infer<OutputSchema>>;
}

export type ToolMetadata = Record<string, unknown> | undefined;
