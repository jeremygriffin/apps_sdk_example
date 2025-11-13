# MCP Todo Backend – Design Spec

## 1. Overview

Build a **TypeScript MCP server** that exposes a **per-user AI-augmented todo list** over MCP, suitable for:

* Integration with **OpenAI Apps SDK** via **HTTP/SSE**.
* Reuse in a future **streaming/WebRTC**–based realtime agent.

The backend must:

* Support **per-user data isolation** using a provided subject identifier.
* Use **Zod** for schema definitions and derive JSON Schema for MCP.
* Provide a **tool registry** so tools are modular and transport-agnostic.
* Include **unit tests** for tools and storage.

---

## 2. Functional Requirements

### 2.1 Core Features

1. **Todo management (per user)**
   * List todos.
   * Create a todo.
   * Toggle completion status.
   * (Optional, but preferred) Update title/notes.
   * Delete a todo.

2. **AI enrichment**
   * “Enrich” a todo with AI-generated content:
     * Summary text.
     * Optional related links (label + URL).
   * For this backend, enrichment can be **simulated** (no need to call OpenAI API) – just generate dummy values.
   * The design should leave clear extension points to plug in real AI calls later.

3. **Per-user personalization**
   * Every request includes a **subject id** (anonymized user id from MCP metadata).
   * All todo operations must be **scoped to that subject id**.
   * No cross-user data leakage.

---

## 3. Tech Stack & Constraints

* **Language**: TypeScript
* **Runtime**: Node.js (LTS)
* **MCP server library**: `@modelcontextprotocol/server` (or equivalent official MCP TS server package)
* **Schemas**: `zod` + `zod-to-json-schema`
* **Tests**: `vitest`
* **Data store** (initial implementation): in-memory store (no external DB)
  * Implementation should be interfaed to make it easy to swap in SQLite or another persistent store.

---

## 4. Project Structure

Target structure (feel free to tweak minor details but keep separation of concerns):

```text
todo-mcp/
  package.json
  tsconfig.json
  src/
    index.sse.ts          # SSE-based server entrypoint (for Apps SDK)
    index.streaming.ts    # (future) streaming/WebRTC entrypoint (placeholder)
    toolRegistry.ts       # central tool registration & shared tool types
    tools/
      listTodos.ts
      createTodo.ts
      toggleTodo.ts
      deleteTodo.ts
      enrichTodo.ts
      updateTodo.ts
    storage/
      index.ts            # Store interface definition
      memoryStore.ts      # in-memory implementation
    types/
      todo.ts             # Zod schema + TS types for Todo & related
  test/
    tools/
      listTodos.test.ts
      createTodo.test.ts
      toggleTodo.test.ts
      deleteTodo.test.ts
      enrichTodo.test.ts
      updateTodo.test.ts
    storage/
      memoryStore.test.ts
```

---

## 5. Data Model

### 5.1 Todo

Define a shared Zod schema and derived TS type for `Todo`.

**Fields:**

* `id: string` – unique per todo.
* `subjectId: string` – owner user’s id (from MCP metadata).
* `title: string`
* `notes?: string`
* `status: "pending" | "in_progress" | "done"`
* `createdAt: string` – ISO 8601 timestamp.
* `updatedAt: string` – ISO 8601 timestamp.

**AI enrichment fields:**

* `aiEnrichmentStatus: "not_started" | "queued" | "running" | "complete" | "error"`
* `aiSummary?: string`
* `aiLinks?: { label: string; url: string }[]`
* `aiLastRunAt?: string` – ISO 8601 timestamp of last enrichment run.

### 5.2 Zod schema

In `src/types/todo.ts`:

* Define a `Todo` Zod schema with the above fields.
* Export:
  * `TodoSchema` (Zod).
  * `Todo` (TS type: `z.infer<typeof TodoSchema>`).
  * Supporting schemas for `AiLink`, etc., as needed.

---

## 6. Storage Layer

### 6.1 Store interface

In `src/storage/index.ts`, define:

```ts
export interface Store {
  getTodosBySubject(subjectId: string): Promise<Todo[]>;
  getTodoById(subjectId: string, todoId: string): Promise<Todo | null>;
  createTodo(
    subjectId: string,
    data: { title: string; notes?: string }
  ): Promise<Todo>;
  updateTodo(
    subjectId: string,
    todoId: string,
    updates: Partial<Pick<Todo, "title" | "notes" | "status">>
  ): Promise<Todo>;
  deleteTodo(subjectId: string, todoId: string): Promise<void>;
  toggleTodoStatus(subjectId: string, todoId: string): Promise<Todo>;
  updateTodoEnrichment(
    subjectId: string,
    todoId: string,
    enrichment: {
      status: Todo["aiEnrichmentStatus"];
      summary?: string;
      links?: { label: string; url: string }[];
      lastRunAt?: string;
    }
  ): Promise<Todo>;
}
```

### 6.2 In-memory implementation

In `src/storage/memoryStore.ts`:

* Implement `Store` with a simple in-memory structure, e.g.:

  ```ts
  type SubjectMap = Map<string, Todo[]>; // subjectId -> Todo[]
  ```

* Ensure all methods:

  * Respect `subjectId`.
  * Throw clear errors when a todo is not found for a given subject.
  * Maintain `createdAt` / `updatedAt` timestamps and `ai*` fields.

Unit tests must cover `memoryStore` behavior independently of MCP.

---

## 7. Tool Registry

### 7.1 Tool types

In `src/toolRegistry.ts` (or a dedicated `src/types/tool.ts`):

* Define:

```ts
import { z, ZodTypeAny } from "zod";

export interface ToolContext {
  subjectId: string;
  // future fields: auth tokens, requestId, etc.
}

export interface ToolDefinition<InputSchema extends ZodTypeAny, OutputSchema extends ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: InputSchema;
  outputSchema: OutputSchema;
  handler: (
    input: z.infer<InputSchema>,
    ctx: ToolContext
  ) => Promise<z.infer<OutputSchema>>;
}
```

* Also define a helper to convert Zod → JSON Schema via `zod-to-json-schema`.

### 7.2 Creating tools

Each tool file in `src/tools` exports a factory that accepts a `Store` and returns a `ToolDefinition<...>`.

Example pattern (for `listTodos.ts`):

```ts
export const createListTodosTool = (store: Store): ToolDefinition<typeof InputSchema, typeof OutputSchema> => ({ ... });
```

### 7.3 Aggregating tools

In `src/toolRegistry.ts`:

* Instantiate the `Store` (e.g., `createMemoryStore()`).
* Create all tool definitions:

```ts
const store = createMemoryStore();

export const tools = [
  createListTodosTool(store),
  createCreateTodoTool(store),
  createToggleTodoTool(store),
  createDeleteTodoTool(store),
  createEnrichTodoTool(store),
  createUpdateTodoTool(store)
];
```

* Provide a helper to build `ToolContext` from MCP metadata:

```ts
export function buildToolContextFromMeta(meta: any): ToolContext {
  // Read subject id from metadata (exact key may differ; make it configurable)
  const subjectId = meta?.["openai/subject"] ?? "anonymous";
  return { subjectId };
}
```

(If the actual subject key differs, make this a configuration constant.)

---

## 8. Tools – Functional & Schema Specs

All schemas must be defined in each tool file using Zod, then converted to JSON Schema for MCP.

### 8.1 `list_todos`

* **Name**: `"list_todos"`
* **Description**: `"List all todos for the current user."`

**Input schema**:

```ts
Input = z.object({});
```

**Output schema**:

```ts
Output = z.object({
  todos: z.array(TodoSchema)
});
```

**Behavior**:

* Use `ctx.subjectId`.
* Return all todos scoped to that subject, sorted by `createdAt` ascending.

---

### 8.2 `create_todo`

* **Name**: `"create_todo"`
* **Description**: `"Create a new todo for the current user."`

**Input schema**:

```ts
Input = z.object({
  title: z.string().min(1),
  notes: z.string().optional()
});
```

**Output schema**:

```ts
Output = z.object({
  todo: TodoSchema
});
```

**Behavior**:

* Use `store.createTodo(ctx.subjectId, { title, notes })`.
* Initialize fields:

  * `status = "pending"`
  * `aiEnrichmentStatus = "not_started"`
  * `aiSummary`, `aiLinks`, `aiLastRunAt` unset.
* Return the created todo.

---

### 8.3 `toggle_todo`

* **Name**: `"toggle_todo"`
* **Description**: `"Toggle the completion status of a todo for the current user."`

**Input schema**:

```ts
Input = z.object({
  todoId: z.string()
});
```

**Output schema**:

```ts
Output = z.object({
  todo: TodoSchema
});
```

**Behavior**:

* Fetch todo by `subjectId` + `todoId`.
* If `status` is `"done"`, set to `"pending"`, otherwise set to `"done"`.
* Update `updatedAt`.
* Return the updated todo.

---

### 8.4 `delete_todo`

* **Name**: `"delete_todo"`
* **Description**: `"Delete a todo for the current user."`

**Input schema**:

```ts
Input = z.object({
  todoId: z.string()
});
```

**Output schema**:

```ts
Output = z.object({
  success: z.literal(true)
});
```

**Behavior**:

* Delete todo with `subjectId` + `todoId`.
* If not found, throw a clear error.
* Return `{ success: true }`.

---

### 8.5 `update_todo` (optional but recommended)

* **Name**: `"update_todo"`
* **Description**: `"Update title, notes, or status of a todo for the current user."`

**Input schema**:

```ts
Input = z.object({
  todoId: z.string(),
  title: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["pending", "in_progress", "done"]).optional()
}).refine(
  (data) => data.title !== undefined || data.notes !== undefined || data.status !== undefined,
  { message: "At least one field must be provided to update." }
);
```

**Output schema**:

```ts
Output = z.object({
  todo: TodoSchema
});
```

**Behavior**:

* Apply partial updates.
* Update `updatedAt`.
* Return updated todo.

---

### 8.6 `enrich_todo`

* **Name**: `"enrich_todo"`
* **Description**: `"Simulate AI enrichment for a todo item (e.g., adding summary and related links)."`

**Input schema**:

```ts
Input = z.object({
  todoId: z.string()
});
```

**Output schema**:

```ts
Output = z.object({
  todo: TodoSchema
});
```

**Behavior** (for this backend demo):

* Fetch todo via `subjectId` + `todoId`.
* Simulate an AI enrichment process:

  * Set `aiEnrichmentStatus` to `"complete"`.
  * Set `aiSummary` to some deterministic but fake summary, e.g.:

    * `"This is a simulated summary for: ${todo.title}"`
  * Optionally set `aiLinks` to a couple of dummy links.
  * Set `aiLastRunAt` to current timestamp.
* Update `updatedAt`.
* Return updated todo.

> **Important**: Implement as synchronous logic; do not introduce actual async background jobs yet. Design should make it easy to replace with a real async job in the future.

---

## 9. MCP SSE Server (Apps SDK Integration)

In `src/index.sse.ts`:

* Use `@modelcontextprotocol/server` (or equivalent) to:

  1. Start an HTTP server listening on a configurable port.
  2. Expose an SSE endpoint (e.g. `/mcp/sse`).
  3. For each tool from `toolRegistry.tools`, register it with the MCP server by:

     * Converting `inputSchema` / `outputSchema` Zod schemas to **JSON Schema**.
     * Wrapping the handler to:

       * Extract tool input.
       * Build `ToolContext` from MCP metadata (to get `subjectId`).
       * Call the tool handler and return its result.

* Include basic error handling & logging.

> The exact usage of the MCP TS server library depends on its API, but the *key requirement* is that this file is the only place that knows about the MCP SDK; tools themselves stay transport-agnostic.

---

## 10. Streaming / WebRTC Entry 

In `src/index.streaming.ts`:

* Provide a placeholder that shows how one could:

  * Spin up a streamable events server with the mcp server streamable transport
  * Import the same `tools` from `toolRegistry`.
* I expect to be able to use the streaming server
  * The tools are cleanly reusable.
  * There is a clear entrypoint file reserved for this future use.

I am expecting both streamable and sse servers to start on "startup"

---

## 11. Testing Requirements

### 11.1 General

* Use `vitest`
* Configure `ts-node`/TS support so tests can be written in TypeScript.
* Ensure `npm test` (or `pnpm test`) runs the full suite.

### 11.2 Storage tests (`test/storage/memoryStore.test.ts`)

Cover:

* Creating todos for different `subjectId`s and ensuring isolation.
* Basic CRUD operations:

  * `createTodo`, `getTodosBySubject`, `getTodoById`.
  * `updateTodo`, `toggleTodoStatus`, `deleteTodo`.
* Enrichment updates:

  * `updateTodoEnrichment` sets fields as expected and doesn’t affect other users.
* Error cases:

  * Attempting to update/delete a missing todo throws an error.

### 11.3 Tool tests (`test/tools/*.test.ts`)

For each tool:

* Mock or use a real `memoryStore` (reset between tests).
* Provide a fake `ToolContext` with known `subjectId`.
* Test:

  * **Happy paths**:

    * `list_todos` returns only the subject’s todos.
    * `create_todo` initializes fields as expected.
    * `toggle_todo` flips `status` correctly.
    * `delete_todo` removes items.
    * `update_todo` updates fields and respects partial updates.
    * `enrich_todo` sets enrichment fields to expected simulated values.
  * **Edge/error cases**:

    * Calling tools with invalid input fails Zod validation.
    * Using a `todoId` that doesn’t exist results in a clear error.

You do **not** need to test the MCP server integration layer heavily; focus on:

* Tool logic.
* Store logic.

---
Absolutely — here is a **clean, well-structured Logging & Debugging Requirements** section you can drop directly into your spec. It fits the design philosophy of the MCP server, supports SSE + streaming adapters, and is safe for Apps SDK environments.

---

# 13. Logging & Debugging Requirements

The MCP backend must include a consistent, configurable logging and debugging strategy that works across:

* **Tool handlers**
* **The storage layer**
* **The SSE adapter (Apps SDK entrypoint)**
* **The future streaming/WebRTC adapter**

Logging must never leak sensitive user data and must be safe for use in production.

---

## 13.1 Logging Framework

Use a lightweight, dependency-free approach unless a logging library is already required elsewhere. Two acceptable options:

1. **Custom wrapper around `console`** with leveled logging
2. Or a small structured logger (e.g. `pino`) if needed later

For MVP: implement option (1).

### Log Levels (minimum)

* `error` – unexpected exceptions or system failures
* `warn` – recoverable issues (invalid input, missing data)
* `info` – lifecycle events (server start, tool registered, store operation)
* `debug` – internal details helpful during development
* `trace` (optional) – extremely verbose per-message or per-state logs

Logging should be configured via environment variable:

* `LOG_LEVEL=debug` (default for development)
* `LOG_LEVEL=info` or higher for production

Implement a `Logger` interface:

```ts
interface Logger {
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}
```

Wrap `console` to respect log level filtering.

Export a single shared logger instance from `src/logger.ts`.

---

## 13.2 What MUST Be Logged

### 13.2.1 Server Initialization (SSE + streaming)

* Port number and path of SSE endpoint (`/mcp/sse` or similar)
* Port/path of streaming entrypoint (if implemented)
* Environment mode (dev/prod)
* Loaded tool names
* Store implementation in use (`memoryStore`, `sqliteStore`, etc.)

Example:

```
[INFO] MCP SSE server listening on :8001 at /mcp/sse
[INFO] Loaded tools: list_todos, create_todo, toggle_todo, delete_todo, enrich_todo
```

---

### 13.2.2 Tool Invocations

For each tool call:

* Tool name
* Timestamp
* Subject ID (masked)
* Validation errors (if any)
* Execution duration
* Whether the handler succeeded or failed

**Important:**
Never log raw tool inputs or full todo objects unless `LOG_LEVEL=debug`.

Mask subject IDs:

* `"user_1234567890abcdef"` → `"user_1234…cdef"`

Format example:

```
[INFO] list_todos invoked by subject=user_12ab…9f
[DEBUG] list_todos input: {}   // only if debug enabled
[INFO] list_todos completed in 3ms
```

Errors example:

```
[ERROR] create_todo failed: Missing title (subject=user_67cd…bb)
```

---

### 13.2.3 Store Operations

Every store method call should emit `debug`-level logs:

* Operation performed (`createTodo`, `deleteTodo`)
* Subject ID (masked)
* Todo ID(s)
* Result count (for list operations)

Example:

```
[DEBUG] getTodosBySubject user_12ab…9f → 3 todos
[DEBUG] toggleTodoStatus user_12ab…9f todo=todo_a31d…22 → done
```

Do *not* log values like `notes`, `aiSummary`, or other potentially sensitive personal content.

---

## 13.3 Error Logging Requirements

All errors thrown during tool execution must:

1. Be logged at `error` level with:

   * tool name
   * masked subject id
   * todo id if available
   * error type/message
   * stack trace at `debug` level

2. Return safe error messages to the MCP client (no stack traces).

Example error log:

```
[ERROR] toggle_todo: Todo not found (todo=deadbeef, subject=user_12ab…9f)
[DEBUG] Error stack: Error: Todo not found ...
```

---

## 13.4 Debug Helpers

Implement a `DEBUG_TOOL_CALLS` environment flag.

When enabled:

* Log full input/output of tools
* Log full todo contents
* Log MCP metadata
* Log Zod validation results

This is for **local development only**.

Example:

```
[DEBUG] Raw MCP request metadata: { ... }
[DEBUG] list_todos output: { todos: [ ...full objects... ] }
```

---

## 13.5 Unit Tests for Logging

Add minimal tests to ensure the logger:

* Respects the selected log level
* Masks subject IDs properly
* Does not throw even when misused
* Formats messages consistently

You do **not** need to snapshot logs—just verify behavior.

---

## 13.6 Forbidden Logging

The backend must **never** log:

* Todo titles, notes, summaries, or AI-generated content at `info` or above
* Raw subject IDs (must mask)
* Raw MCP metadata except in debug mode
* OpenAI OAuth tokens or API keys
* IP addresses or fine-grained location data
* Errors containing stack traces at user-facing levels

---

## 13.7 Developer-Facing Debug Mode

Add a helper script:

```
npm run debug-sse
```

Which starts the MCP SSE server with:

```
LOG_LEVEL=debug
DEBUG_TOOL_CALLS=true
NODE_ENV=development
```

This is meant for developer troubleshooting and can show:

* Incoming tool calls
* Parsed metadata
* Tool registry loading
* Store operations

---

# Summary

This logging/debugging section ensures:

* Safety (no sensitive leaks)
* Observability (structured logs)
* Developer friendliness (debug flags, masked IDs)
* Reuse across SSE & streaming transport layers
* Testable and maintainable behavior

---

If you want, I can now **insert this into the full spec**, or rewrite the entire spec cleanly with this appended.


---
## 13. Non-Goals / Future Extensions

These are **out of scope for now**, but design should not make them hard:

* Actual OpenAI API calls for AI enrichment.
* Real async job processing (queues, workers).
* Persistent DB (SQLite/Postgres).
* Full realtime/WebRTC transport implementation.

---

This spec should give you everything needed to implement the MCP server backend with:

* A clean tool registry.
* Zod-based schemas.
* SSE entrypoint for Apps SDK.
*  streamable transport entrypoint
* Reusable tools for future streaming/WebRTC.
* Unit tests for store + tools.

