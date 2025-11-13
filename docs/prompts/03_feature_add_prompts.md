# 📌 Feature Request: Implement MCP Prompt Support for Todo Backend

## Overview

The Todo MCP backend currently supports tools and resources.
We now want to **add first-class support for MCP Prompts**, allowing ChatGPT / Apps SDK to access structured prompt templates that assist in task creation, summarization, prioritization, and refinement.

This feature introduces:

* A **Prompt Registry**
* MCP handlers for:

  * `prompts/list`
  * `prompts/get`
* Server capability updates (`capabilities.prompts`)
* A minimal **initial catalog** of well-defined prompts

This should be implemented in a clean, extensible way similar to how tools are registered.

---

# 🎯 Goals

1. Add backend support for MCP “Prompts” per the MCP spec.
2. Expose a list of named prompt templates used by the model to:

   * Extract todos
   * Summarize
   * Clarify
   * Prioritize
   * Break down tasks
3. Ensure prompts can be easily extended or modified without changing the server core.
4. Ensure all prompt outputs match or map cleanly to the existing tool schemas (especially `create_todo`).

---

# 📐 Requirements

### 1. **Prompts Registry**

Create a central registry similar to `toolRegistry.ts`:

* File: `src/prompts/promptRegistry.ts`
* Exports a list/array of prompt definitions.
* Support the following fields:

```ts
interface PromptDefinition {
  name: string;
  description: string;
  arguments: PromptArgument[];   // array describing template parameters
  messages: PromptMessage[];     // system + user messages with {{placeholders}}
}
```

Where:

```ts
interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
  type: "string" | "enum";       // minimal for now
  enumValues?: string[];
}

interface PromptMessage {
  role: "system" | "user";
  content: string;               // templated with {{argumentName}}
}
```

### 2. **MCP Prompt Handlers**

Implement **two new MCP methods**:

#### `prompts/list`

* Returns list of available prompts
* Response shape:

```ts
{
  prompts: Array<{
    name: string;
    description: string;
    arguments: PromptArgument[];
  }>
}
```

#### `prompts/get`

* Input: `{ name: string }`
* Output: Full prompt definition, including messages

### 3. **Server Initialization Support**

Extend `initialize` response:

```ts
capabilities: {
  tools: { listChanged: true },
  resources: { subscribe: true },
  prompts: {}        // presence indicates support
}
```

### 4. **Prompt Placeholder Substitution**

Implement a simple substitution helper:

```ts
function renderPromptMessage(message: PromptMessage, args: Record<string, string>): string;
```

That replaces:

```
{{argumentName}}
```

with actual values before sending messages to the model.

### 5. **Validation**

* Add Zod schemas for prompt arguments to prevent broken templating.
* Ensure all returned prompts match the registry definitions.

---

# 📚 Initial Prompt Catalog

The coding agent should implement the following **five core prompts**:

---

## 1. **`brain_dump_to_todos`**

**Description:**
Convert a messy user brain-dump into structured todo items that match the `create_todo` tool input structure.

**Arguments:**

* `dump: string`
* `timeframe?: "today" | "this_week" | "someday"`

**Notes:**
Output JSON must match the `create_todo` tool input schema exactly.

---

## 2. **`summarize_todos`**

**Description:**
Produce a short status summary of the user’s todo list, based on a JSON array passed by the client.

**Arguments:**

* `todosJson: string`
* `timeframe?: string`

---

## 3. **`prioritize_todos`**

**Description:**
Assign priority levels (“high”, “medium”, “low”) to the user’s active todos and justify top items.

**Arguments:**

* `todosJson: string`
* `maxFocusItems?: number`

---

## 4. **`clarify_todo`**

**Description:**
Rewrite a single todo’s title and notes to be clearer, more actionable, and more concise.

**Arguments:**

* `title: string`
* `notes?: string`

---

## 5. **`suggest_subtasks`**

**Description:**
Break a large todo into 3–7 smaller subtasks appropriate for short work sessions.

**Arguments:**

* `title: string`
* `notes?: string`
* `maxSubtasks?: number`

---

# 🧪 Testing Requirements

* Add unit tests for:

  * `prompts/list`
  * `prompts/get`
  * templating/placeholder expansion
  * invalid prompt names
* Add snapshot tests for each default prompt definition.
* Ensure prompt outputs can be parsed and validated against existing tool schemas.

---

# 🗂 File Layout

```
src/
  prompts/
    promptRegistry.ts
    types.ts
    handlers/
      listPromptsHandler.ts
      getPromptHandler.ts

  server/
    index.sse.ts        // update initialize()
```

Tests:

```
tests/
  prompts/
    listPrompts.test.ts
    getPrompt.test.ts
    templating.test.ts
```

---

# ✔ Acceptance Criteria

* Server advertises `capabilities.prompts` in `initialize`.
* `prompts/list` returns the five new prompts.
* `prompts/get` returns a specific prompt with messages and arguments.
* Prompt substitution works correctly and has test coverage.
* All prompt outputs align with existing tool schemas.

