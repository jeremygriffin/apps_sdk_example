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
npm run dev:ui     # run the ChatGPT-facing todo UI (Vite dev server)
npm run build:ui   # build the UI for production
```

The server now exposes both MCP transports on a single HTTP listener (default `http://localhost:3001`).

- SSE stream: `GET http://localhost:3001/mcp/sse` then `POST` JSON-RPC messages to `/mcp/sse/messages?sessionId=<id>`
- Streamable HTTP: `http://localhost:3001/mcp/stream` for POST/GET/DELETE as defined in the MCP spec

Configuration can be provided via `env.json` in the repository root or standard environment variables. Values from the shell override anything defined in `env.json`. Supported keys include `SERVER_HOST`, `SERVER_PORT`, `SSE_PATH`, `SSE_MESSAGE_PATH`, `STREAMING_PATH`, `LOG_LEVEL`, `DEBUG_TOOL_CALLS`, and `SUBJECT_METADATA_KEYS`.

```json
{
  "SERVER_PORT": "3100",
  "SERVER_HOST": "127.0.0.1",
  "DEBUG_TOOL_CALLS": "true"
}
```

### Changing Ports Quickly
The HTTP listener always uses `SERVER_PORT` (default `3001`). Set it inline for ad-hoc runs (`SERVER_PORT=4100 npm start`) or pin it inside `env.json` when you need a repeatable local default. `SERVER_HOST` behaves the same way, so you can bind to `0.0.0.0` for containerized testing without touching the codebase. All transports—SSE stream, SSE messages, and streamable HTTP—share this single listener, so you only need to change the port once.

### Why `/mcp/sse/messages`?
The SSE adapter deliberately splits the endpoints:

- `GET /mcp/sse` upgrades the connection to a server-sent events stream so the client can receive JSON-RPC responses.
- JSON-RPC requests must be `POST`ed to `/mcp/sse/messages?sessionId=<id>`, not `/mcp/sse`, because the SSE stream endpoint is read-only. The separate `/messages` path lets us keep the stream connection open while accepting new tool calls on standard HTTP posts.

If you need to customize either path, override `SSE_PATH` or `SSE_MESSAGE_PATH` via env vars or `env.json`.

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

## Todo UI (ChatGPT Apps SDK)

The `packages/todo-ui` directory contains the React + Vite UI that renders inside ChatGPT. It communicates solely through `window.openai.callTool` and handles structured logging plus a local development shim. Use the scripts above (`npm run dev:ui`, `npm run build:ui`, `npm run preview:ui`) to work on the frontend locally.

Debug logging for the UI can be enabled by appending `?debug=1` to the iframe URL or by running `localStorage.setItem("todo-ui-debug", "1")`. When debug mode is enabled, the UI surfaces bridge diagnostics, tool-call traces, and optional error details.
