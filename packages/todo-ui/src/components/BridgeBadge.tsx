import { isDebugEnabled } from "../logger";
import type { BridgeDiagnostics } from "../types";

interface BridgeBadgeProps {
  diagnostics: BridgeDiagnostics;
}

export const BridgeBadge = ({ diagnostics }: BridgeBadgeProps) => {
  if (!isDebugEnabled()) {
    return null;
  }
  const parts = [
    `bridge=${diagnostics.hasBridge ? "yes" : "no"}`,
    `callTool=${diagnostics.hasCallTool ? "yes" : "no"}`,
    `onToolOutput=${diagnostics.hasOnToolOutput ? "yes" : "no"}`
  ];

  return <div className="bridge-badge">Connection: {parts.join(", ")}</div>;
};
