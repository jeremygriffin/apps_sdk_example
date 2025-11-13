export type LogLevelName =
  | "debug"
  | "info"
  | "notice"
  | "warning"
  | "error"
  | "critical"
  | "alert"
  | "emergency";

const LOG_LEVELS: LogLevelName[] = [
  "debug",
  "info",
  "notice",
  "warning",
  "error",
  "critical",
  "alert",
  "emergency"
];

const normalizeLogLevel = (value: string | undefined): LogLevelName => {
  if (!value) {
    return "info";
  }
  return LOG_LEVELS.includes(value as LogLevelName) ? (value as LogLevelName) : "info";
};

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const rawSubjectKeys = process.env.SUBJECT_METADATA_KEYS ?? "openai/subject,subjectId";

export const config = {
  logLevel: normalizeLogLevel(process.env.LOG_LEVEL),
  debugToolCalls: process.env.DEBUG_TOOL_CALLS === "true",
  nodeEnv: process.env.NODE_ENV ?? "development",
  sse: {
    host: process.env.SSE_HOST ?? "0.0.0.0",
    port: parseNumber(process.env.SSE_PORT, 8001),
    path: process.env.SSE_PATH ?? "/mcp/sse",
    messagePath: process.env.SSE_MESSAGE_PATH ?? "/mcp/sse/messages"
  },
  streaming: {
    host: process.env.STREAMING_HOST ?? "0.0.0.0",
    port: parseNumber(process.env.STREAMING_PORT, 8101),
    path: process.env.STREAMING_PATH ?? "/mcp/stream"
  },
  subjectMetadataKeys: rawSubjectKeys
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
};
