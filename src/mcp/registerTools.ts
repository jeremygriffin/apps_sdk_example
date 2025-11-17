import type { IncomingHttpHeaders } from "node:http";

import { randomUUID } from "node:crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  CallToolResult,
  ServerNotification,
  ServerRequest
} from "@modelcontextprotocol/sdk/types.js";
import { type ZodRawShape, type ZodTypeAny, ZodEffects, ZodObject } from "zod";

import { Logger, maskSubjectId } from "@/logger";
import { DEFAULT_TOOL_ANNOTATIONS, executeToolByName, tools } from "@/toolRegistry";
import type { ToolMetadata } from "@/types/tool";
import { getTodoUiWidgetMeta } from "@/ui/uiResources";
import { sanitizeStructuredContent } from "@/utils/sanitize";

const SUBJECT_HEADER_CANDIDATES = ["x-openai-subject", "x-subject-id", "openai-subject"];

const extractSubjectFromHeaders = (headers?: IncomingHttpHeaders): string | undefined => {
  if (!headers) {
    return undefined;
  }
  for (const key of SUBJECT_HEADER_CANDIDATES) {
    const value = headers[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (Array.isArray(value)) {
      const first = value.find((entry) => entry.trim().length > 0);
      if (first) {
        return first.trim();
      }
    }
  }
  return undefined;
};

const unwrapObjectSchema = (schema: ZodTypeAny): ZodObject<any> | undefined => {
  if (schema instanceof ZodObject) {
    return schema;
  }
  if (schema instanceof ZodEffects) {
    return unwrapObjectSchema(schema.innerType());
  }
  return undefined;
};

const toRawShape = (schema: ZodTypeAny): ZodRawShape | undefined => {
  const objectSchema = unwrapObjectSchema(schema);
  return objectSchema ? objectSchema.shape : undefined;
};

const sanitizeMetadata = (meta: unknown): Record<string, unknown> | undefined => {
  if (!meta || typeof meta !== "object") {
    return undefined;
  }
  return { ...(meta as Record<string, unknown>) };
};

const extractSubjectFromAuthExtra = (extraData: unknown): string | undefined => {
  if (!extraData || typeof extraData !== "object") {
    return undefined;
  }
  const candidate = (extraData as Record<string, unknown>).subject;
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }
  return undefined;
};

const normalizeSubjectId = (
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  metadata: Record<string, unknown> | undefined
): string | undefined => {
  const headerSubject = extractSubjectFromHeaders(extra.requestInfo?.headers);
  if (headerSubject) {
    return headerSubject;
  }
  const authSubject =
    extractSubjectFromAuthExtra(extra.authInfo?.extra) ?? extractSubjectFromAuthExtra(extra.authInfo);
  if (authSubject) {
    return authSubject;
  }
  const metaSubjectCandidate = metadata?.["subjectId"];
  if (typeof metaSubjectCandidate === "string" && metaSubjectCandidate.trim().length > 0) {
    return metaSubjectCandidate.trim();
  }
  return undefined;
};

export const registerToolsWithServer = (server: McpServer, log: Logger) => {
  tools.forEach((tool) => {
    const inputShape = toRawShape(tool.inputSchema);
    const outputShape = toRawShape(tool.outputSchema);
    const widgetMeta = getTodoUiWidgetMeta();
    const toolMeta = widgetMeta ? { ...widgetMeta } : undefined;

    server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: tool.description,
        inputSchema: inputShape,
        outputSchema: outputShape,
        _meta: toolMeta,
        annotations: DEFAULT_TOOL_ANNOTATIONS
      },
      async (args, extra) => {
        const metadataRecord = sanitizeMetadata(extra._meta);
        const subjectOverride = normalizeSubjectId(extra, metadataRecord);
        if (metadataRecord && subjectOverride && metadataRecord["openai/subject"] === undefined) {
          metadataRecord["openai/subject"] = subjectOverride;
        }

        const metadata: ToolMetadata =
          metadataRecord && Object.keys(metadataRecord).length > 0 ? metadataRecord : undefined;
        const invocationId = randomUUID();
        const sanitizedSubject = subjectOverride ? maskSubjectId(subjectOverride) : "anonymous";
        const normalizedArgs = args ?? {};

        log.info("mcp.tool.request", {
          invocationId,
          tool: tool.name,
          subject: sanitizedSubject,
          arguments: normalizedArgs,
          metadata: metadataRecord ?? {}
        });

        try {
          const result = await executeToolByName(tool.name, normalizedArgs, {
            metadata,
            subjectId: subjectOverride,
            logger: log
          });

          const responseEnvelope: CallToolResult = {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2)
              }
            ],
            structuredContent: result as CallToolResult["structuredContent"],
            _meta: widgetMeta ? { ...widgetMeta } : undefined
          };

          log.info("mcp.tool.response", {
            invocationId,
            tool: tool.name,
            subject: sanitizedSubject,
            structuredContent: sanitizeStructuredContent(result),
            meta: responseEnvelope._meta ?? {}
          });

          return responseEnvelope;
        } catch (error) {
          log.error("mcp.tool.error", {
            invocationId,
            tool: tool.name,
            error: error instanceof Error ? error.message : String(error)
          });
          throw error;
        }
      }
    );
  });
};
