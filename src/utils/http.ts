import { IncomingHttpHeaders, IncomingMessage } from "node:http";

export const readJsonBody = (req: IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req
      .on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      .on("error", reject)
      .on("end", () => {
        if (chunks.length === 0) {
          resolve({});
          return;
        }
        const payload = Buffer.concat(chunks).toString("utf8").trim();
        if (!payload) {
          resolve({});
          return;
        }
        try {
          resolve(JSON.parse(payload));
        } catch (error) {
          reject(error);
        }
      });
  });

const SENSITIVE_HEADER_KEYS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key"
]);

const redactHeaderValue = (value: string | string[]): string | string[] => {
  if (Array.isArray(value)) {
    return value.map(() => "[REDACTED]");
  }
  return "[REDACTED]";
};

export const sanitizeHeaders = (
  headers: IncomingHttpHeaders
): Record<string, string | string[]> => {
  return Object.entries(headers).reduce<Record<string, string | string[]>>(
    (acc, [key, value]) => {
      if (value === undefined) {
        return acc;
      }
      const normalizedKey = key.toLowerCase();
      acc[key] = SENSITIVE_HEADER_KEYS.has(normalizedKey)
        ? redactHeaderValue(value)
        : value;
      return acc;
    },
    {}
  );
};
