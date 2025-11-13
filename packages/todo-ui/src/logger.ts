import type { BridgeDiagnostics } from "./types";

const hasWindow = typeof window !== "undefined";

const getSearchDebugFlag = () => {
  if (!hasWindow) {
    return false;
  }
  try {
    const searchParams = new URLSearchParams(window.location.search ?? "");
    return searchParams.get("debug") === "1";
  } catch {
    return false;
  }
};

const getStoredDebugFlag = () => {
  if (!hasWindow) {
    return false;
  }
  try {
    return window.localStorage.getItem("todo-ui-debug") === "1";
  } catch {
    return false;
  }
};

const DEBUG_ENABLED = getSearchDebugFlag() || getStoredDebugFlag();

export const isDebugEnabled = () => DEBUG_ENABLED;

const prefix = "[todo-ui]";

export const logDebug = (...args: unknown[]) => {
  if (!DEBUG_ENABLED) return;
  console.debug(prefix, ...args);
};

export const logInfo = (...args: unknown[]) => {
  if (!DEBUG_ENABLED) return;
  console.info(prefix, ...args);
};

export const logWarn = (...args: unknown[]) => {
  console.warn(prefix, ...args);
};

export const logError = (...args: unknown[]) => {
  console.error(prefix, ...args);
};

export const getBridgeDiagnostics = (): BridgeDiagnostics => {
  if (!hasWindow) {
    return {
      hasBridge: false,
      hasCallTool: false,
      hasOnToolOutput: false
    };
  }
  const bridge = window.openai;
  return {
    hasBridge: Boolean(bridge),
    hasCallTool: Boolean(bridge?.callTool),
    hasOnToolOutput: Boolean(bridge?.onToolOutput)
  };
};
