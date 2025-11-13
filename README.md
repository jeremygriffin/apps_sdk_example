# MCP Todo Backend

A TypeScript implementation of a Model Context Protocol–ready todo backend that exposes MCP tools over both SSE (for the OpenAI Apps SDK) and a placeholder streaming/WebRTC endpoint. Todos are stored per subject in memory, enriched with deterministic AI metadata, and protected by strict logging/masking rules.

## Features
- Zod-based schemas with JSON Schema export for all tools.
- In-memory per-subject store with isolation, enrichment helpers, and unit tests.
- Tool registry that centralizes validation, logging, and execution.
- SSE adapter exposing `/mcp/sse` and `/mcp/tools/:name` for simple MCP-style integration.
- Streaming/WebRTC placeholder server that reserves an entrypoint for future work.
- Debug toggles via `LOG_LEVEL` and `DEBUG_TOOL_CALLS` plus masked logging helpers.

> **Note:** The official `@modelcontextprotocol/server` package was unavailable in this workspace’s npm registry. A lightweight SSE adapter compliant with the spec replaces it so development can continue offline.

## Getting Started
```bash
npm install
npm start          # start both SSE and streaming entrypoints
npm run sse        # start only the SSE adapter
npm run streaming  # start only the streaming placeholder
npm run debug-sse  # start SSE adapter with verbose debug logging
```

Servers default to:
- SSE: `http://localhost:8001/mcp/sse`
- Tool invocations: `POST http://localhost:8001/mcp/tools/<tool_name>`
- Streaming placeholder: `POST http://localhost:8101/mcp/stream`

You can customize ports/paths via environment variables (`SSE_PORT`, `SSE_PATH`, `STREAMING_PORT`, etc.).

### Invoking Tools over HTTP
Send a JSON body with `input`, optional `metadata`, and an optional `subjectId` override:

```bash
curl -X POST http://localhost:8001/mcp/tools/create_todo \
  -H 'Content-Type: application/json' \
  -H 'X-Subject-Id: demo-user-123' \
  -d '{
        "input": { "title": "Draft MCP spec" },
        "metadata": { "openai/subject": "demo-user-123" }
      }'
```

Responses follow `{ ok: boolean, result?: any, error?: string }`.

### Debug Mode
Set `DEBUG_TOOL_CALLS=true` (or run `npm run debug-sse`) to log complete tool inputs/outputs, metadata, and store operations for local troubleshooting. Sensitive fields remain masked at info level per the spec.

## Testing
```bash
npm test          # runs Vitest suite with coverage configuration
npm run test:watch
npm run typecheck
```

Tests cover the storage layer, logging utility, and every tool handler to guard against regressions.
