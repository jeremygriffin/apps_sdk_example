import { z, ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { config } from "./config";
import { logger, maskSubjectId, shouldDebugToolCalls } from "./logger";
import { Store } from "./storage";
import { createMemoryStore } from "./storage/memoryStore";
import { ToolContext, ToolDefinition, ToolMetadata } from "./types/tool";
import { createCreateTodoTool } from "./tools/createTodo";
import { createDeleteTodoTool } from "./tools/deleteTodo";
import { createEnrichTodoTool } from "./tools/enrichTodo";
import { createListTodosTool } from "./tools/listTodos";
import { createToggleTodoTool } from "./tools/toggleTodo";
import { createUpdateTodoTool } from "./tools/updateTodo";

const store: Store = createMemoryStore();

const toolFactories = [
  createListTodosTool,
  createCreateTodoTool,
  createToggleTodoTool,
  createDeleteTodoTool,
  createEnrichTodoTool,
  createUpdateTodoTool
];

export const tools: ToolDefinition<ZodTypeAny, ZodTypeAny>[] = toolFactories.map((factory) =>
  factory(store)
);

const SCHEMA_OPTIONS = {
  $refStrategy: "none"
} as const;

const schemaCache = new Map<string, { input: unknown; output: unknown }>();

export const getToolSchemas = (
  tool: ToolDefinition<ZodTypeAny, ZodTypeAny>
): { input: unknown; output: unknown } => {
  if (schemaCache.has(tool.name)) {
    return schemaCache.get(tool.name)!;
  }
  const schemas = {
    input: zodToJsonSchema(tool.inputSchema, SCHEMA_OPTIONS),
    output: zodToJsonSchema(tool.outputSchema, SCHEMA_OPTIONS)
  };
  schemaCache.set(tool.name, schemas);
  return schemas;
};

const DEFAULT_SUBJECT_ID = "anonymous";

const extractSubjectFromMetadata = (metadata: ToolMetadata): string => {
  if (!metadata) {
    return DEFAULT_SUBJECT_ID;
  }
  for (const key of config.subjectMetadataKeys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  const fallback = metadata?.subjectId;
  if (typeof fallback === "string" && fallback.trim().length > 0) {
    return fallback.trim();
  }
  return DEFAULT_SUBJECT_ID;
};

export const buildToolContextFromMeta = (
  metadata: ToolMetadata,
  overrides?: { subjectId?: string }
): ToolContext => {
  const subjectId = overrides?.subjectId ?? extractSubjectFromMetadata(metadata);
  return {
    subjectId,
    metadata
  };
};

export const getToolByName = (name: string) => tools.find((tool) => tool.name === name);

export const getToolCatalog = () =>
  tools.map((tool) => {
    const schemas = getToolSchemas(tool);
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: schemas.input,
      outputSchema: schemas.output
    };
  });

export interface ExecuteToolOptions {
  metadata?: ToolMetadata;
  subjectId?: string;
}

export const executeToolByName = async (
  toolName: string,
  rawInput: unknown,
  options: ExecuteToolOptions = {}
) => {
  const tool = getToolByName(toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  const metadata = options.metadata;
  const subjectId = options.subjectId ?? extractSubjectFromMetadata(metadata);
  const ctx = buildToolContextFromMeta(metadata, { subjectId });
  const maskedSubject = maskSubjectId(subjectId);

  let parsedInput: z.infer<typeof tool.inputSchema>;
  const parseStart = performance.now();
  try {
    parsedInput = tool.inputSchema.parse(rawInput ?? {});
  } catch (error) {
    logger.warn("tool input validation failed", {
      tool: tool.name,
      subject: maskedSubject,
      error: error instanceof Error ? error.message : "unknown"
    });
    throw error;
  }
  const parseDuration = performance.now() - parseStart;
  if (shouldDebugToolCalls()) {
    logger.debug("tool input accepted", {
      tool: tool.name,
      subject: maskedSubject,
      durationMs: parseDuration,
      input: parsedInput
    });
  } else {
    logger.info("tool invoked", {
      tool: tool.name,
      subject: maskedSubject,
      durationMs: parseDuration
    });
  }

  const start = performance.now();
  try {
    const result = await tool.handler(parsedInput, ctx);
    const durationMs = performance.now() - start;
    if (shouldDebugToolCalls()) {
      logger.debug("tool completed", {
        tool: tool.name,
        subject: maskedSubject,
        durationMs,
        output: result
      });
    } else {
      logger.info("tool completed", {
        tool: tool.name,
        subject: maskedSubject,
        durationMs
      });
    }
    return result;
  } catch (error) {
    logger.error("tool failed", {
      tool: tool.name,
      subject: maskedSubject,
      error: error instanceof Error ? error.message : error
    });
    throw error;
  }
};
import { performance } from "node:perf_hooks";
