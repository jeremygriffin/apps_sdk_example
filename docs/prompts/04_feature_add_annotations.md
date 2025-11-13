# ✨ Feature Request: Add Todo Annotations for AI-Driven Prioritization

## Overview

Introduce **annotations** to the Todo MCP backend to support **AI-assisted prioritization and planning**. These annotations act as machine-readable signals that prompts and LLM agents use to sort, group, and structure todos more intelligently.

This feature adds three optional annotation fields to each todo:

* `priority`: numeric importance (1–5)
* `complexity`: numeric difficulty/effort (1–3)
* `marker`: symbolic classification (`circle`, `triangle`, `square`, `diamond`)

These values may be set explicitly by the user or inferred and set by the LLM through existing update tools.

---

## Motivation

The current todo data model lacks structured signals that would allow the LLM to reason effectively about:

* What tasks should be done first
* What tasks require significant effort
* Which items are “quick wins” vs “deep work”
* Which tasks are high-value or strategic

Introducing annotations enables:

* Better **prioritization prompts** (e.g., “help me plan my day”)
* More accurate LLM-driven organization
* Smarter task grouping and scheduling
* Clearer user-facing summaries (“urgent tasks”, “quick wins”)

Annotations become **inputs** into your MCP prompt templates, enabling a richer and more intelligent agent experience.

---

## Requirements

### 1. Extend the Todo Schema

Modify the existing `Todo` schema in `src/types/todo.ts` to include:

```ts
priority?: number;        // 1–5 (importance)
complexity?: number;      // 1–3 (effort)
marker?: "circle" | "triangle" | "square" | "diamond"; // semantic category
```

All fields are optional; unset fields imply “unknown”.

**Semantic meanings** (used by prompts and LLM):

* **priority**: how important the task is
* **complexity**: estimated difficulty or time required
* **marker**: qualitative tag

  * `circle`: quick / lightweight
  * `triangle`: needs attention / potential blockers
  * `square`: structured / routine
  * `diamond`: strategic / high-value

### 2. Update Relevant Tools

Extend `update_todo` (and, if implemented, `annotate_todo`) to accept annotation fields:

```ts
priority?: number;       // 1–5
complexity?: number;     // 1–3
marker?: "circle" | "triangle" | "square" | "diamond";
```

Zod schemas must validate the ranges and allowed values.

All annotation updates must trigger `updatedAt` refresh.

### 3. Ensure Proper Binding in Storage Layer

Modify store methods (`updateTodo`) to persist and return annotation fields.

For the in-memory store:

* Preserve annotations in `updateTodo`
* Serialize/destructure correctly when returning Todos

### 4. Do *Not* Set Annotations Automatically in Backend

Annotations must be:

* Set by explicit user instruction
* Set by LLM reasoning (via tool calls)
* Never silently defaulted in storage or server

This preserves:

* A neutral backend
* Trustworthy annotation meaning
* Predictable LLM behavior

### 5. Add Annotation Awareness to Prompts (future extension)

Not required in this PR, but annotations exist primarily for:

* `prioritize_todos` prompt
* `summarize_todo_load` prompt

Prompts will use annotations to group & plan tasks.

---

## User Experience

Users will be able to say things like:

* “Make this task priority 5.”
* “Mark the dashboard rebuild as a diamond.”
* “This one is high complexity — set it to 3.”

The LLM will then call:

```json
{
  "tool": "update_todo",
  "arguments": {
    "todoId": "123",
    "priority": 5
  }
}
```

This behavior is **expected and intended**.

---

## Acceptance Criteria

* [ ] Todo schema extended with `priority`, `complexity`, `marker`
* [ ] Zod + JSON Schema updated accordingly
* [ ] `update_todo` accepts new fields
* [ ] Storage layer stores/returns new fields
* [ ] Unit tests added for annotation handling
* [ ] No auto-assignment of annotation values
* [ ] No user-facing or LLM-facing breaking changes

---

## Final piece:

* as a last step we should add a separate `annotate_todo` tool for cleaner intent separation?

