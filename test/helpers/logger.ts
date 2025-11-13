import { Logger } from "../../src/logger";

export const createSilentLogger = (): Logger => ({
  level: "error",
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
  isLevelEnabled: () => false
});
