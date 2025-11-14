import fs from "node:fs";

import { config } from "@/config";
import { Logger } from "@/logger";

const HTML_MIME_TYPE = "text/html+skybridge";

const assetPattern = /(src|href)=["'](\/?assets\/[^"']+)["']/g;

const rewriteAssetUrls = (html: string, baseUrl: string): string => {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  return html.replace(assetPattern, (_match, attr: string, assetPath: string) => {
    const sanitized = assetPath.replace(/^\/+/, "");
    return `${attr}="${normalizedBase}/${sanitized}"`;
  });
};

export const isTodoUiEnabled = () => config.ui.enabled;

export const getTodoUiWidgetMeta = () => {
  if (!config.ui.enabled) {
    return undefined;
  }
  return {
    "openai/outputTemplate": config.ui.resourceUri,
    "openai/toolInvocation/invoking": config.ui.toolInvocation.invoking,
    "openai/toolInvocation/invoked": config.ui.toolInvocation.invoked,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true
  };
};

export const getTodoUiResourceDescriptor = () => ({
  uri: config.ui.resourceUri,
  name: config.ui.resourceName,
  description: config.ui.resourceDescription,
  mimeType: HTML_MIME_TYPE,
  _meta: getTodoUiWidgetMeta()
});

export const loadTodoUiHtml = (log: Logger): string => {
  if (!config.ui.enabled) {
    throw new Error("Todo UI bundle is not enabled");
  }
  try {
    const rawHtml = fs.readFileSync(config.ui.indexHtmlPath, "utf-8");
    return rewriteAssetUrls(rawHtml, config.ui.publicBaseUrl);
  } catch (error) {
    log.error("failed to read todo ui bundle", {
      error: error instanceof Error ? error.message : String(error),
      path: config.ui.indexHtmlPath
    });
    throw error;
  }
};

export const getTodoUiMimeType = () => HTML_MIME_TYPE;

export const __private__ = {
  rewriteAssetUrls
};
