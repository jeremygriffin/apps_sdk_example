# MCP Todo Backend

A TypeScript implementation of a Model Context Protocol–ready todo backend that exposes MCP tools over both the official Streamable HTTP transport and the legacy SSE endpoint (for the OpenAI Apps SDK). Todos are stored per subject in memory, enriched with deterministic AI metadata, and protected by strict logging/masking rules.

## Features
- Zod-based schemas with JSON Schema export for all tools.
- In-memory per-subject store with isolation, enrichment helpers, and unit tests.
- Tool registry that centralizes validation, logging, and execution.
- SSE adapter powered by `@modelcontextprotocol/sdk` that serves `/mcp/sse` (stream) and `/mcp/sse/messages` (JSON-RPC posts).
- Streamable HTTP server that listens on `/mcp/stream` for POST/GET/DELETE per the MCP spec (ready for future realtime/WebRTC integration).
- MCP logging capability with runtime level adjustments via `logging/setLevel` and streamed `notifications/message`.
- Debug toggles via `LOG_LEVEL` and `DEBUG_TOOL_CALLS` plus masked logging helpers.

## Getting Started
```bash
npm install
npm start          # start both SSE and streaming entrypoints
npm run sse        # start only the SSE adapter
npm run streaming  # start only the streamable HTTP server
npm run debug-sse  # start SSE adapter with verbose debug logging
```

Servers default to:
- SSE stream: `GET http://localhost:8001/mcp/sse` (clients then `POST` JSON-RPC messages to `/mcp/sse/messages?sessionId=<id>`)
- Streamable HTTP: `http://localhost:8101/mcp/stream` for POST/GET/DELETE as defined in the MCP spec

You can customize ports/paths via environment variables (`SSE_PORT`, `SSE_PATH`, `STREAMING_PORT`, etc.).

### Invoking Tools
Use any MCP-compatible client (e.g., OpenAI Apps SDK) to connect via either:

1. `GET /mcp/sse` followed by JSON-RPC `POST`s to `/mcp/sse/messages?sessionId=<id>` (deprecated SSE transport, still required by existing Apps clients).
2. Streamable HTTP (`POST` initialization + `GET`/`DELETE` with the `Mcp-Session-Id` header) at `/mcp/stream`.

Both transports share the same tool registry, schemas, and masked logging behavior.

### Debug Mode
Set `DEBUG_TOOL_CALLS=true` (or run `npm run debug-sse`) to log complete tool inputs/outputs, metadata, and store operations for local troubleshooting. Sensitive fields remain masked at info level per the spec.

### MCP Logging
The server advertises the MCP `logging` capability. Clients can call `logging/setLevel` with any syslog-compatible level (`debug`, `info`, `notice`, `warning`, `error`, `critical`, `alert`, `emergency`) to adjust the minimum severity streamed via `notifications/message`. All messages are structured JSON with masked subject identifiers, so no sensitive data leaks into logs even when verbose tracing is enabled.

## Testing
```bash
npm test          # runs Vitest suite with coverage configuration
npm run test:watch
npm run typecheck
```

Tests cover the storage layer, logging utility, and every tool handler to guard against regressions.
