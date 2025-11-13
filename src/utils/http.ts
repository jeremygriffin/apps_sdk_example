import { IncomingMessage } from "node:http";

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
