import { useState } from "react";

import { isDebugEnabled } from "../logger";

interface ErrorBannerProps {
  message: string;
  detail?: string;
  toolName?: string;
  onDismiss?: () => void;
}

export const ErrorBanner = ({ message, detail, toolName, onDismiss }: ErrorBannerProps) => {
  const [expanded, setExpanded] = useState(false);
  const debug = isDebugEnabled();
  const canShowDetails = debug && (detail || toolName);

  return (
    <div className="error-banner" data-testid="error-banner">
      <div>
        <strong>{message}</strong>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canShowDetails ? (
          <button className="secondary" type="button" onClick={() => setExpanded((prev) => !prev)}>
            {expanded ? "Hide details" : "Show details"}
          </button>
        ) : null}
        {onDismiss ? (
          <button className="secondary" type="button" onClick={onDismiss}>
            Dismiss
          </button>
        ) : null}
      </div>
      {expanded && canShowDetails ? (
        <div style={{ fontSize: "0.85rem", color: "#475569" }}>
          {detail ? <div>Error: {detail}</div> : null}
          {toolName ? <div>Tool: {toolName}</div> : null}
        </div>
      ) : null}
    </div>
  );
};
