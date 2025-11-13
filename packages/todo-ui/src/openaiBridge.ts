import { createDevShim } from "./devShim";
import { logDebug, logError, logInfo, logWarn } from "./logger";
import type {
  ListTodosOutput,
  OpenAIWindowBridge,
  ToolName
} from "./types";
import { isListTodosOutput } from "./types";

const hasWindow = typeof window !== "undefined";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

const createCorrelationId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const ensureOpenAiBridge = (): OpenAIWindowBridge => {
  if (!hasWindow) {
    throw new Error("window is not available");
  }
  if (!window.openai) {
    window.openai = createDevShim();
    logInfo("Using dev shim for window.openai");
  }
  return window.openai;
};

export const callTool = async <TInput, TOutput>(
  name: ToolName,
  input: TInput
): Promise<TOutput> => {
  const bridge = ensureOpenAiBridge();
  if (!bridge.callTool) {
    logError("callTool is unavailable on the OpenAI bridge");
    throw new Error("OpenAI bridge is missing callTool support");
  }
  return bridge.callTool(name, input) as Promise<TOutput>;
};

export const callToolWithLogging = async <TInput, TOutput>(
  name: ToolName,
  input: TInput
): Promise<TOutput> => {
  const start = now();
  const correlationId = createCorrelationId();
  logInfo("Tool call started", { name, correlationId });
  logDebug("Tool input", { name, input, correlationId });

  try {
    const result = await callTool<TInput, TOutput>(name, input);
    logInfo("Tool call success", {
      name,
      correlationId,
      durationMs: Math.round(now() - start)
    });
    logDebug("Tool output", { name, result, correlationId });
    return result;
  } catch (error) {
    logError("Tool call failed", {
      name,
      correlationId,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Math.round(now() - start)
    });
    throw error;
  }
};

export const subscribeToToolOutput = (cb: (output: unknown) => void) => {
  if (!hasWindow) {
    return undefined;
  }
  const bridge = ensureOpenAiBridge();
  if (!bridge.onToolOutput) {
    logWarn("onToolOutput missing on OpenAI bridge");
    return undefined;
  }
  const cleanup = bridge.onToolOutput(cb);
  return typeof cleanup === "function" ? cleanup : undefined;
};

export const hydrateFromToolOutput = (
  toolOutput: unknown,
  onValid: (value: ListTodosOutput) => void,
  onInvalid?: () => void
) => {
  if (isListTodosOutput(toolOutput)) {
    onValid(toolOutput);
    return true;
  }
  logWarn("Received unexpected tool output", {
    kind: Array.isArray(toolOutput) ? "array" : typeof toolOutput,
    keys: toolOutput && typeof toolOutput === "object" ? Object.keys(toolOutput as Record<string, unknown>) : []
  });
  if (onInvalid) {
    onInvalid();
  }
  return false;
};
