import { createLogger, Logger } from "../../src/logger";

export const createSilentLogger = (): Logger => {
  const silentLogger = createLogger("emergency", () => {});
  silentLogger.sendLogMessage = () => {};
  return silentLogger;
};
