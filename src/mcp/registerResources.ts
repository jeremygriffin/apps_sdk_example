import { Buffer } from "node:buffer";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ErrorCode,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  type ListResourceTemplatesResult,
  type ListResourcesResult,
  type ReadResourceResult
} from "@modelcontextprotocol/sdk/types.js";

import { Logger } from "@/logger";
import {
  getTodoUiMimeType,
  getTodoUiResourceDescriptor,
  getTodoUiWidgetMeta,
  isTodoUiEnabled,
  loadTodoUiHtml
} from "@/ui/uiResources";

export const registerResourcesWithServer = (server: McpServer, log: Logger) => {
  if (!isTodoUiEnabled()) {
    return;
  }

  const descriptor = getTodoUiResourceDescriptor();
  const meta = getTodoUiWidgetMeta();

  server.server.registerCapabilities({
    resources: {
      subscribe: true
    }
  });
  server.server.assertCanSetRequestHandler(ListResourcesRequestSchema.shape.method.value);
  server.server.assertCanSetRequestHandler(ReadResourceRequestSchema.shape.method.value);
  server.server.assertCanSetRequestHandler(ListResourceTemplatesRequestSchema.shape.method.value);

  server.server.setRequestHandler(ListResourcesRequestSchema, (): ListResourcesResult => ({
    resources: [descriptor]
  }));

  server.server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    (): ListResourceTemplatesResult => ({
      resourceTemplates: [
        {
          uriTemplate: descriptor.uri,
          name: descriptor.name,
          description: descriptor.description,
          mimeType: descriptor.mimeType,
          _meta: meta
        }
      ]
    })
  );

  server.server.setRequestHandler(ReadResourceRequestSchema, (): ReadResourceResult => {
    let html: string;
    try {
      html = loadTodoUiHtml(log);
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Todo UI bundle unavailable: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    log.info("todo.ui.resource", {
      uri: descriptor.uri,
      bytes: Buffer.byteLength(html, "utf-8")
    });

    return {
      contents: [
        {
          uri: descriptor.uri,
          mimeType: getTodoUiMimeType(),
          text: html,
          _meta: meta
        }
      ]
    };
  });
};
