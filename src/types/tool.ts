import { z, ZodTypeAny } from "zod";

import { Logger } from "@/logger";

export interface ToolContext {
  subjectId: string;
  logger: Logger;
  metadata?: Record<string, unknown>;
}

export interface AnyToolDefinition {
  name: string;
  description: string;
  inputSchema: ZodTypeAny;
  outputSchema: ZodTypeAny;
  handler: (input: any, ctx: ToolContext) => Promise<any>;
}

export interface ToolDefinition<
  InputSchema extends ZodTypeAny,
  OutputSchema extends ZodTypeAny
> extends AnyToolDefinition {
  inputSchema: InputSchema;
  outputSchema: OutputSchema;
  handler: (
    input: z.infer<InputSchema>,
    ctx: ToolContext
  ) => Promise<z.infer<OutputSchema>>;
}

export type ToolMetadata = Record<string, unknown> | undefined;
