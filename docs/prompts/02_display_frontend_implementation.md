Here is the **complete, consolidated implementation plan** as a single clean **Markdown document**, including the frontend UI spec, lifecycle, architecture, interactions, logging/debugging guidance, and testing strategy.
You can hand this directly to a coding agent.

---

# Todo App – Frontend Implementation Plan (ChatGPT Apps SDK)

This document defines the full implementation plan for the Todo App’s **frontend UI** that runs inside ChatGPT. It is designed to pair with the MCP server tools and deliver a clean, predictable, testable UI.

Everything here is implementation-ready.

---

# 1. Architectural Overview

### Purpose

This UI is rendered by ChatGPT inside an iframe via the **Apps SDK**, and interacts exclusively through:

* `window.openai.toolOutput` — latest tool output
* `window.openai.onToolOutput(cb)` — subscription mechanism
* `window.openai.callTool(name, input)` — call MCP tools

The UI **never** talks directly to the backend; it only issues tool calls.

### Relevant backend tools (MCP)

* `list_todos`
* `create_todo`
* `toggle_todo`
* `delete_todo`
* `enrich_todo`

### Shared Data Contract

```ts
type Todo = {
  id: string;
  subjectId: string;
  title: string;
  notes?: string;
  status: "pending" | "in_progress" | "done";
  createdAt: string;
  updatedAt: string;
  aiEnrichmentStatus:
    | "not_started"
    | "queued"
    | "running"
    | "complete"
    | "error";
  aiSummary?: string;
  aiLinks?: { label: string; url: string }[];
  aiLastRunAt?: string;
};

type ListTodosOutput = {
  todos: Todo[];
};
```

### Project Structure

```
packages/
  todo-ui/
    src/
      main.tsx
      TodoApp.tsx
      components/
      types.ts
      openaiBridge.ts
```

Build system: Vite + React + TypeScript.

---

# 2. Global Types & Utilities

## 2.1 `window.openai` typing

```ts
export interface OpenAIWindowBridge {
  toolOutput?: unknown;
  onToolOutput?: (cb: (output: unknown) => void) => void;
  callTool?: (toolName: string, input: any) => Promise<any>;
}

declare global {
  interface Window {
    openai?: OpenAIWindowBridge;
  }
}
```

## 2.2 Type guard

```ts
export function isListTodosOutput(value: any): value is ListTodosOutput {
  return value && Array.isArray(value.todos);
}
```

## 2.3 Minimal tool wrapper

```ts
export async function callTool<TInput, TOutput>(
  name: string,
  input: TInput
): Promise<TOutput> {
  if (!window.openai?.callTool) {
    throw new Error("OpenAI bridge not available");
  }
  return window.openai.callTool(name, input);
}
```

---

# 3. Logging & Debugging Strategy

## 3.1 Debug mode activation

Debug mode is enabled when:

* URL includes `?debug=1`, or
* `localStorage.setItem("todo-ui-debug", "1")`

## 3.2 Logging helpers

```ts
const DEBUG_ENABLED =
  typeof window !== "undefined" &&
  (window.location.search.includes("debug=1") ||
    window.localStorage.getItem("todo-ui-debug") === "1");

function logDebug(...args: unknown[]) {
  if (DEBUG_ENABLED) console.debug("[todo-ui]", ...args);
}

function logInfo(...args: unknown[]) {
  if (DEBUG_ENABLED) console.info("[todo-ui]", ...args);
}

function logWarn(...args: unknown[]) {
  console.warn("[todo-ui]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[todo-ui]", ...args);
}
```

## 3.3 Tool-call wrapper with detailed logging

```ts
async function callToolWithLogging<TInput, TOutput>(
  name: string,
  input: TInput
): Promise<TOutput> {
  const start = performance.now();
  const correlationId = crypto.randomUUID();

  logInfo("Tool call started", { name, correlationId });
  logDebug("Input", { input });

  try {
    const result = await callTool<TInput, TOutput>(name, input);
    logInfo("Tool call success", {
      name,
      correlationId,
      durationMs: Math.round(performance.now() - start),
    });
    logDebug("Output", { result });
    return result;
  } catch (error) {
    logError("Tool call failed", {
      name,
      correlationId,
      error,
      durationMs: Math.round(performance.now() - start),
    });
    throw error;
  }
}
```

## 3.4 Debug-only connection indicator

In debug mode, show a small badge:

```
Connection: bridge=[yes/no], callTool=[yes/no], onToolOutput=[yes/no]
```

This provides immediate visibility into whether ChatGPT wired the UI correctly.

---

# 4. UI State & Lifecycle

## 4.1 UI State

```ts
type UiState = {
  loading: boolean;
  error: string | null;
  todos: Todo[] | null;
};
```

## 4.2 Lifecycle

### On mount:

* Log bridge presence.
* Check `window.openai.toolOutput`:

  * If `ListTodosOutput` → hydrate state.
  * Else → start in `loading=true` and call `list_todos`.
* Subscribe to `onToolOutput`:

  * If new output is `ListTodosOutput`, update `todos`.

### Refresh behavior:

```ts
async function refresh() {
  state.loading = true;
  try {
    await callToolWithLogging("list_todos", {});
  } catch (err) {
    state.error = "Unable to fetch todos.";
  } finally {
    state.loading = false;
  }
}
```

---

# 5. UI Layout & Components

## 5.1 Overall Layout

* **Header**

  * Title: “Your Todos”
  * Subtitle: “Scoped to your ChatGPT session.”

* **Stats Row**

  * Completion count: “3 of 8 done”
  * Refresh button

* **New Todo Form**

  * Fields: title, optional notes
  * On submit: `create_todo` → refresh

* **Todo List**

  * Each item shows:

    * Checkbox (toggle)
    * Title
    * Notes (expandable)
    * AI status badge
    * Enrich / Retry enrichment button
    * Delete button

* **AI Details Panel**

  * Shown when expanded and `aiSummary` exists
  * Render:

    * `aiSummary`
    * `aiLinks[]`

## 5.2 Four Render States

1. **Loading**

   * Spinner or “Loading todos…”

2. **Error**

   * Global banner: “Something went wrong.”
   * Retry button

3. **Empty List**

   * Message: “You don’t have any todos yet.”
   * New todo form visible

4. **Normal List**

   * Full UI

---

# 6. User Actions & Tool Mappings

| UI Action     | Tool Called   | Payload             | Then        |
| ------------- | ------------- | ------------------- | ----------- |
| Create Todo   | `create_todo` | `{ title, notes? }` | `refresh()` |
| Toggle Status | `toggle_todo` | `{ todoId }`        | `refresh()` |
| Delete        | `delete_todo` | `{ todoId }`        | `refresh()` |
| Enrich        | `enrich_todo` | `{ todoId }`        | `refresh()` |

All handlers must:

* Log start/end via logging helpers.
* Catch errors:

  * Log error
  * Display banner
  * Optionally show per-item inline error text

---

# 7. Error Handling

## 7.1 Global Error Banner

* Message: “There was a problem performing that action.”
* Dismissible
* In debug mode, expandable details section (`error.message`, last tool name)

## 7.2 Per-item Error (optional)

For item actions (toggle/delete/enrich), optional small inline text:

> “Unable to update this todo.”

## 7.3 Missing or malformed `toolOutput`

If initial toolOutput is not a `ListTodosOutput`:

* Soft warning: “This view expected a todo list but received something else.”
* Button: “Fetch todos” (calls `list_todos`)

---

# 8. Dev Mode / Local Development

When running UI outside ChatGPT:

* Provide **dev shim**:

```ts
if (!window.openai) {
  window.openai = createDevShim();
  logInfo("Using dev shim for window.openai");
}
```

Dev shim:

* `callTool` → in-memory fake data
* `onToolOutput` → emits `ListTodosOutput` after fake updates

---

# 9. Testing Strategy

Using **React Testing Library + Vitest/Jest**.

### 9.1 Render Tests

* Loading state
* Empty state
* Non-empty list
* Expanded AI details
* Error banner

### 9.2 Interaction Tests

Mock `window.openai.callTool`:

* Creating a todo calls `create_todo` with correct payload
* Toggling calls `toggle_todo`
* Delete calls `delete_todo`
* Enrichment calls `enrich_todo`
* Refresh calls `list_todos`

### 9.3 Error Tests

* If `callTool` rejects → banner appears
* Retry button resubmits `list_todos`
* Invalid initial toolOutput handled gracefully

### 9.4 Test IDs

Use `data-testid`:

* `todo-app`
* `new-todo-form`
* `error-banner`
* `todo-item` (with `data-id`)

---

# 10. Delivery Checklist for Coding Agent

* [ ] Implement all UI components described in this plan.
* [ ] Implement logging system + debug mode.
* [ ] Wrap all tool calls in `callToolWithLogging`.
* [ ] Handle lifecycle hydration + onToolOutput subscription.
* [ ] Implement dev shim.
* [ ] Add testing suite covering render, interactions, and errors.
* [ ] Ensure no sensitive user content logged in production mode.

---

If you want, I can also generate a **repository-ready starter directory** or a **drop-in `TodoApp.tsx` implementation**.

