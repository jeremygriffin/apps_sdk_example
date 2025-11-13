import { createLogger, Logger } from "@/logger";

export const createSilentLogger = (): Logger => {
  const silentLogger = createLogger("emergency", () => {});
  silentLogger.sendLogMessage = () => {};
  return silentLogger;
};
