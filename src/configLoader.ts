import fs from "node:fs";
import path from "node:path";

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

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) {
    return fallback;
  }
  return value === "true" || value === "1";
};

interface ConfigLogger {
  warn: (message: string, meta?: Record<string, unknown>) => void;
}

const defaultConfigLogger: ConfigLogger = {
  warn: (message, meta) => {
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "warning",
      logger: "config",
      data: { message, ...meta }
    }));
  }
};

const readEnvJson = (
  envFilePath: string,
  logger: ConfigLogger
): Record<string, string> => {
  try {
    const raw = fs.readFileSync(envFilePath, "utf-8");
    if (!raw.trim()) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return Object.keys(parsed).reduce<Record<string, string>>((acc, key) => {
        const value = parsed[key];
        if (typeof value === "string") {
          acc[key] = value;
        }
        return acc;
      }, {});
    }
    return {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    logger.warn("failed to read env.json", {
      error: error instanceof Error ? error.message : String(error)
    });
    if (error instanceof SyntaxError) {
      throw error;
    }
    return {};
  }
};

const ensureLeadingSlash = (value: string): string => {
  if (!value) return "/";
  return value.startsWith("/") ? value : `/${value}`;
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "") || "/";

export interface RuntimeConfig {
  logLevel: LogLevelName;
  debugToolCalls: boolean;
  nodeEnv: string;
  server: {
    host: string;
    port: number;
    ssePath: string;
    sseMessagesPath: string;
    streamPath: string;
  };
  ui: {
    enabled: boolean;
    distPath: string;
    indexHtmlPath: string;
    mountPath: string;
    publicBaseUrl: string;
    resourceUri: string;
    resourceName: string;
    resourceDescription: string;
    toolInvocation: {
      invoking: string;
      invoked: string;
    };
    assetsAvailable: boolean;
  };
  subjectMetadataKeys: string[];
  configSources: {
    envFilePath: string;
    envFileFound: boolean;
  };
}

export interface ConfigLoaderOptions {
  env?: Record<string, string | undefined>;
  envFilePath?: string;
  logger?: ConfigLogger;
}

export const loadRuntimeConfig = (options: ConfigLoaderOptions = {}): RuntimeConfig => {
  const envFilePath = options.envFilePath ?? path.resolve(process.cwd(), "env.json");
  const configLogger = options.logger ?? defaultConfigLogger;
  const envFileValues = readEnvJson(envFilePath, configLogger);
  const env = options.env ?? process.env;

  const fromSources = (key: string): string | undefined => {
    return env[key] ?? envFileValues[key];
  };

  const serverPort = parseNumber(
    fromSources("SERVER_PORT") ?? fromSources("PORT") ?? fromSources("SSE_PORT") ?? fromSources("STREAMING_PORT"),
    3001
  );
  const serverHost = fromSources("SERVER_HOST") ?? fromSources("HOST") ?? "0.0.0.0";
  const ssePath = fromSources("SSE_PATH") ?? "/mcp/sse";
  const sseMessagesPath = fromSources("SSE_MESSAGE_PATH") ?? "/mcp/sse/messages";
  const streamPath = fromSources("STREAMING_PATH") ?? "/mcp/stream";

  const uiEnabled = parseBoolean(fromSources("TODO_UI_ENABLED"), true);
  const uiDistPath = path.resolve(
    process.cwd(),
    fromSources("TODO_UI_DIST_PATH") ?? path.join("packages", "todo-ui", "dist")
  );
  const uiIndexFile = path.resolve(
    uiDistPath,
    fromSources("TODO_UI_INDEX_FILE") ?? "index.html"
  );
  const uiMountPath = ensureLeadingSlash(fromSources("TODO_UI_MOUNT_PATH") ?? "/todo-ui");
  const publicServerUrlRaw = fromSources("PUBLIC_SERVER_URL") ?? fromSources("SERVER_PUBLIC_URL");
  const normalizedServerUrl = publicServerUrlRaw
    ? trimTrailingSlash(publicServerUrlRaw)
    : `http://localhost:${serverPort}`;
  const uiPublicBaseUrl = `${normalizedServerUrl}${uiMountPath}`;
  const uiResourceUri = fromSources("TODO_UI_RESOURCE_URI") ?? "ui://todo/board.html";
  const uiResourceName = fromSources("TODO_UI_RESOURCE_NAME") ?? "Todo board";
  const uiResourceDescription =
    fromSources("TODO_UI_RESOURCE_DESCRIPTION") ?? "Interactive todo board UI";
  const uiToolInvoking =
    fromSources("TODO_UI_TOOL_INVOKING") ?? "Loading the todo board";
  const uiToolInvoked =
    fromSources("TODO_UI_TOOL_INVOKED") ?? "Todo board ready";
  const uiAssetsAvailable = fs.existsSync(uiDistPath) && fs.existsSync(uiIndexFile);

  const subjectKeysRaw = fromSources("SUBJECT_METADATA_KEYS") ?? "openai/subject,subjectId";
  const subjectMetadataKeys = subjectKeysRaw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return {
    logLevel: normalizeLogLevel(fromSources("LOG_LEVEL")),
    debugToolCalls: parseBoolean(fromSources("DEBUG_TOOL_CALLS")),
    nodeEnv: fromSources("NODE_ENV") ?? "development",
    server: {
      host: serverHost,
      port: serverPort,
      ssePath,
      sseMessagesPath,
      streamPath
    },
    ui: {
      enabled: uiEnabled && uiAssetsAvailable,
      distPath: uiDistPath,
      indexHtmlPath: uiIndexFile,
      mountPath: uiMountPath,
      publicBaseUrl: uiPublicBaseUrl,
      resourceUri: uiResourceUri,
      resourceName: uiResourceName,
      resourceDescription: uiResourceDescription,
      toolInvocation: {
        invoking: uiToolInvoking,
        invoked: uiToolInvoked
      },
      assetsAvailable: uiAssetsAvailable
    },
    subjectMetadataKeys,
    configSources: {
      envFilePath,
      envFileFound: Object.keys(envFileValues).length > 0
    }
  };
};
