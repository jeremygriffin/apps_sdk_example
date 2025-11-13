import { loadRuntimeConfig } from "./configLoader";

export type { LogLevelName, RuntimeConfig } from "./configLoader";

export const config = loadRuntimeConfig();
