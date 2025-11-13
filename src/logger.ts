import { config, LogLevelName } from "./config";

export interface LogContext {
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevelName;
  message: string;
  context?: LogContext;
}

export type LogSink = (entry: LogEntry) => void;

const levelWeights: Record<LogLevelName, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const isLevelEnabled = (target: LogLevelName, configured: LogLevelName): boolean =>
  levelWeights[target] <= levelWeights[configured];

const safeContextString = (context?: LogContext): string => {
  if (!context || Object.keys(context).length === 0) {
    return "";
  }
  try {
    return ` ${JSON.stringify(context)}`;
  } catch {
    return " [unserializable-context]";
  }
};

const defaultSink: LogSink = ({ level, message, context }) => {
  const ctxString = safeContextString(context);
  const formatted = `[${level.toUpperCase()}] ${message}${ctxString}`;
  const method = level === "debug" ? "debug" : level === "warn" ? "warn" : level === "error" ? "error" : "info";
  // eslint-disable-next-line no-console
  (console as Console)[method](formatted);
};

export interface Logger {
  level: LogLevelName;
  error: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  debug: (message: string, context?: LogContext) => void;
  isLevelEnabled: (level: LogLevelName) => boolean;
}

export interface LoggerOptions {
  level?: LogLevelName;
  sink?: LogSink;
  name?: string;
}

export const createLogger = (options: LoggerOptions = {}): Logger => {
  const level = options.level ?? config.logLevel;
  const sink = options.sink ?? defaultSink;
  const log = (entryLevel: LogLevelName, message: string, context?: LogContext) => {
    if (!isLevelEnabled(entryLevel, level)) {
      return;
    }
    const fullContext = options.name
      ? {
          ...context,
          logger: options.name
        }
      : context;
    try {
      sink({ level: entryLevel, message, context: fullContext });
    } catch (error) {
      defaultSink({
        level: "error",
        message: `Logger sink failure: ${(error as Error).message}`,
        context: { logger: options.name ?? "todo-mcp" }
      });
    }
  };

  return {
    level,
    error: (message, context) => log("error", message, context),
    warn: (message, context) => log("warn", message, context),
    info: (message, context) => log("info", message, context),
    debug: (message, context) => log("debug", message, context),
    isLevelEnabled: (entryLevel) => isLevelEnabled(entryLevel, level)
  };
};

export const shouldDebugToolCalls = (): boolean => config.debugToolCalls;

export const maskSubjectId = (subjectId?: string | null): string => {
  if (!subjectId) {
    return "unknown";
  }
  const trimmed = subjectId.trim();
  if (trimmed.length <= 8) {
    return `${trimmed[0]}***${trimmed[trimmed.length - 1]}`;
  }
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
};

export const logger = createLogger({ name: "todo-mcp" });
