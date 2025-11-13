# ✨ Feature Request: Add Prioritization & Summarization Prompts Using Todo Annotations

## Overview

With the introduction of **todo annotations** (`priority`, `complexity`, `marker`), the next step is to expose **MCP prompts** that use these annotations to generate:

* prioritized lists
* task summaries
* planning guidance
* workload categorization

Prompts are a first-class MCP feature (similar to tools), allowing the LLM to request and fill prompt templates.
These prompts will turn the annotation metadata into **smart, structured AI reasoning** without hardcoding logic inside tool handlers.

This feature adds:

* A new `prompts/` directory
* A `promptRegistry.ts` similar to the tool registry
* Two initial prompts:

  1. `prioritize_todos`
  2. `summarize_todo_load`

Future prompts can easily be added to the registry.

---

## Motivation

Annotations don’t provide value on their own — they unlock richer AI reasoning when consumed by **prompts**.

These prompts will:

* Sort & cluster todos using annotations
* Highlight “quick wins” vs “deep work”
* Provide planning for “today”, “this week”, etc.
* Help LLM agents generate better follow-up tool calls
* Improve the user experience inside ChatGPT Apps

This separates **domain data (todos)** from **AI behavior (prompts)**, which fits the MCP architecture perfectly.

---

## Requirements

### 1. Create a Prompt Registry

Similar to `toolRegistry.ts`, implement:

```
src/prompts/
  prioritizeTodos.ts
  summarizeTodoLoad.ts

src/promptRegistry.ts
```

`promptRegistry.ts` should:

* Collect all prompt definitions
* Present them to the MCP server during `prompts/list`
* Provide a `getPrompt(name)` mechanism for `prompts/get`

### 2. Define a Standard Prompt Interface

Prompts must include:

```ts
interface McpPrompt {
  name: string;
  description: string;
  parameters?: ZodSchema;      // optional input parameters
  messages: PromptMessage[];   // structured template
}
```

Where `PromptMessage` = { role: "system" | "user" | "assistant", content: string }

This matches MCP’s expected prompt format.

---

## 3. Add Prompt: `prioritize_todos`

### Purpose

Generate a **prioritized task plan** using annotations.

### Description

> “Given a list of todos with annotations (priority, complexity, marker), produce an ordered task list and recommended action plan for a specified timeframe.”

### Parameters (Zod)

```ts
{
  todos: Todo[],       // required: supplied by LLM from list_todos
  timeframe?: string   // optional: "today" | "this_week" | "later"
}
```

### Prompt Template (conceptual)

System:

```
You are a task-planning assistant.

Each todo contains:
- priority (1 to 5): importance
- complexity (1 to 3): effort required
- marker: one of circle (quick), triangle (attention/risk), square (routine), diamond (high value)

Use these annotations to:
1. Rank todos from most urgent/important to least.
2. Identify "quick wins" (priority ≥ 3 and complexity < 2).
3. Identify "deep work" items (complexity > 2).
4. Highlight strategic/high-value tasks (diamond markers).
5. Produce a recommended workplan, honoring the timeframe if provided.
```

User section:

```
Here are the todos to prioritize:

{{todos}}

Timeframe: {{timeframe}}
```

(The raw todos will be injected as JSON.)

---

## 4. Add Prompt: `summarize_todo_load`

### Purpose

Produce a **summary analysis** of the user’s workload based on annotations.

### Description

> “Summarize the user’s current task load by grouping todos into meaningful buckets derived from priority, complexity, and marker.”

### Parameters

```ts
{
  todos: Todo[]
}
```

### Template (conceptual)

System:

```
Summarize the user's current workload.
Break tasks into:
- Top Priority (priority 4–5)
- Quick Wins (complexity ≤ 2 or marker=circle)
- Deep Work (complexity ≥ 2 or marker=diamond)
- Maintenance/Routine (marker=square)
- Attention Needed (marker=triangle)

Provide a short, actionable summary in plain language.
```

User:

```
Here are the todos:

{{todos}}
```

---

## 5. Registry Integration

`promptRegistry.ts` exports:

```ts
export const prompts = [
  prioritizeTodosPrompt,
  summarizeTodoLoadPrompt
];
```

The SSE server (`index.sse.ts`) must:

* expose `prompts/list`
* expose `prompts/get`
* include prompt registry during initialization

---

## 6. Unit Tests

### For each prompt:

* [ ] Ensure parameter schema validates
* [ ] Ensure all template tokens exist
* [ ] Ensure registry lists the new prompt
* [ ] Ensure `prompts/get` returns the template

No need to test generative output.

---

## Acceptance Criteria

* [ ] `prompts/` directory added
* [ ] Two prompts implemented: prioritization + summarization
* [ ] Prompt registry created
* [ ] SSE server exposes prompts via MCP
* [ ] Unit tests added
* [ ] No backend-breaking changes
* [ ] Prompts correctly reference annotations

---

## Future Extensions

* “Plan my day” prompt that produces a structured schedule
* A “derive annotations” prompt that suggests priority/complexity/marker
* A “motivation summary” or “weekly planning” workflow
* A “risk analysis” prompt using triangle/diamond markers
