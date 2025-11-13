import { config, LogLevelName } from "./config";

export type LogLevel = LogLevelName;

export interface LogData {
  [key: string]: unknown;
}

export interface LogEvent {
  timestamp: string;
  level: LogLevel;
  logger: string;
  data?: LogData;
}

export type LoggerSink = (event: LogEvent) => void;

const LOG_LEVEL_ORDER: LogLevel[] = [
  "debug",
  "info",
  "notice",
  "warning",
  "error",
  "critical",
  "alert",
  "emergency"
];

const LEVEL_WEIGHT: Record<LogLevel, number> = LOG_LEVEL_ORDER.reduce(
  (acc, level, index) => {
    acc[level] = index;
    return acc;
  },
  {} as Record<LogLevel, number>
);

type ConsoleLogMethod = "debug" | "info" | "warn" | "error";

const pickConsoleMethod = (level: LogLevel): ConsoleLogMethod => {
  if (level === "warning" || level === "notice") {
    return "warn";
  }
  if (level === "error" || level === "critical" || level === "alert" || level === "emergency") {
    return "error";
  }
  if (level === "debug") {
    return "debug";
  }
  return "info";
};

const defaultSink: LoggerSink = (event) => {
  const method = pickConsoleMethod(event.level);
  // eslint-disable-next-line no-console
  console[method](JSON.stringify(event));
};

const isLevelEnabled = (target: LogLevel, configured: LogLevel): boolean =>
  LEVEL_WEIGHT[target] >= LEVEL_WEIGHT[configured];

export const isLogLevel = (value: unknown): value is LogLevel =>
  typeof value === "string" && (value as string) in LEVEL_WEIGHT;

const assertLogLevel = (value: unknown): LogLevel => {
  if (!isLogLevel(value)) {
    throw new Error(`Unsupported log level: ${String(value)}`);
  }
  return value;
};

export interface Logger {
  getLevel: () => LogLevel;
  setLevel: (level: LogLevel) => void;
  log: (level: LogLevel, loggerName: string, data?: LogData) => void;
  debug: (loggerName: string, data?: LogData) => void;
  info: (loggerName: string, data?: LogData) => void;
  notice: (loggerName: string, data?: LogData) => void;
  warn: (loggerName: string, data?: LogData) => void;
  warning: (loggerName: string, data?: LogData) => void;
  error: (loggerName: string, data?: LogData) => void;
  critical: (loggerName: string, data?: LogData) => void;
  alert: (loggerName: string, data?: LogData) => void;
  emergency: (loggerName: string, data?: LogData) => void;
  sendLogMessage: (level: LogLevel, loggerName: string, data?: LogData) => void;
}

const safeInvoke = (fn: () => void) => {
  try {
    fn();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        logger: "logger",
        data: {
          error: error instanceof Error ? error.message : String(error)
        }
      })
    );
  }
};

export const createLogger = (
  initialLevel: LogLevel = "info",
  sink: LoggerSink = defaultSink
): Logger => {
  let currentLevel = assertLogLevel(initialLevel);

  const logImpl = (level: LogLevel, loggerName: string, data?: LogData) => {
    if (!isLevelEnabled(level, currentLevel)) {
      return;
    }
    const event: LogEvent = {
      timestamp: new Date().toISOString(),
      level,
      logger: loggerName,
      data
    };
    safeInvoke(() => sink(event));
    safeInvoke(() => loggerInstance.sendLogMessage(level, loggerName, data));
  };

  const loggerInstance: Logger = {
    getLevel: () => currentLevel,
    setLevel: (level: LogLevel) => {
      currentLevel = assertLogLevel(level);
    },
    log: logImpl,
    debug: (loggerName, data) => logImpl("debug", loggerName, data),
    info: (loggerName, data) => logImpl("info", loggerName, data),
    notice: (loggerName, data) => logImpl("notice", loggerName, data),
    warn: (loggerName, data) => logImpl("warning", loggerName, data),
    warning: (loggerName, data) => logImpl("warning", loggerName, data),
    error: (loggerName, data) => logImpl("error", loggerName, data),
    critical: (loggerName, data) => logImpl("critical", loggerName, data),
    alert: (loggerName, data) => logImpl("alert", loggerName, data),
    emergency: (loggerName, data) => logImpl("emergency", loggerName, data),
    sendLogMessage: () => {}
  };

  return loggerInstance;
};

export const logger = createLogger(config.logLevel);

export const shouldDebugToolCalls = (activeLogger: Logger | undefined = logger): boolean =>
  config.debugToolCalls || activeLogger.getLevel() === "debug";

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
