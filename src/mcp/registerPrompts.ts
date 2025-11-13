import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ErrorCode,
  GetPromptRequestSchema,
  GetPromptResult,
  ListPromptsRequestSchema,
  ListPromptsResult,
  McpError,
  PromptMessage as McpPromptMessage
} from "@modelcontextprotocol/sdk/types.js";

import { Logger } from "../logger";
import {
  getPromptByName,
  getPromptCatalog,
  normalizePromptArguments,
  PromptArgumentError,
  PromptMessage,
  renderPromptMessage
} from "../prompts/promptRegistry";

const toMcpMessage = (
  template: PromptMessage,
  args: Record<string, string>
): McpPromptMessage => ({
  role: template.role === "user" ? "user" : "assistant",
  content: {
    type: "text",
    text: renderPromptMessage(template, args)
  }
});

export const registerPromptsWithServer = (server: McpServer, log: Logger) => {
  server.server.assertCanSetRequestHandler(ListPromptsRequestSchema.shape.method.value);
  server.server.assertCanSetRequestHandler(GetPromptRequestSchema.shape.method.value);

  server.server.registerCapabilities({
    prompts: {}
  });

  server.server.setRequestHandler(ListPromptsRequestSchema, () => {
    const catalog = getPromptCatalog();
    log.info("prompt catalog requested", { promptCount: catalog.length });
    return {
      prompts: catalog
    } satisfies ListPromptsResult;
  });

  server.server.setRequestHandler(GetPromptRequestSchema, (request) => {
    const prompt = getPromptByName(request.params.name);
    if (!prompt) {
      throw new McpError(ErrorCode.InvalidParams, `Prompt ${request.params.name} not found`);
    }

    let args: Record<string, string>;
    try {
      args = normalizePromptArguments(prompt, request.params.arguments);
    } catch (error) {
      if (error instanceof PromptArgumentError) {
        throw new McpError(ErrorCode.InvalidParams, error.message);
      }
      throw error;
    }

    const messages = prompt.messages.map((message) => toMcpMessage(message, args));
    log.info("prompt template rendered", { prompt: prompt.name });

    return {
      description: prompt.description,
      arguments: prompt.arguments,
      messages
    } satisfies GetPromptResult & {
      arguments: typeof prompt.arguments;
    };
  });
};
