# **Feature: MCP Logging Capability**

*Add-on Specification for Todo MCP Server*

## **1. Overview**

This feature adds **first-class logging support** to the Todo MCP server, following the **Model Context Protocol (MCP) logging specification**.
Logging allows:

* The server to emit structured log messages to MCP clients (e.g., Apps SDK, ChatGPT)
* Clients to optionally configure the server’s minimum log level
* Tools, storage operations, and server internals to provide structured, masked, non-sensitive telemetry

This feature integrates with:

* The existing tool registry
* The existing `ToolContext` construction (subject masking)
* The SSE transport
* Internal console logging

---

## **2. Goals**

1. **Declare MCP logging capability** in the server’s `initialize` response.
2. **Implement `logging/setLevel`** so clients can adjust verbosity.
3. **Stream log notifications** using MCP `notifications/message`.
4. Provide an internal **Logger** abstraction with:

   * Log level filtering (syslog-level semantics)
   * Structured log events
   * Emission to console + MCP notification system
   * Integration into `ToolContext` to allow tool-level logging
5. Ensure logs contain **no sensitive values**, but may include masked subject IDs.

---

## **3. MCP Logging Requirements**

### **3.1 Protocol-Level Requirements**

The server **MUST**:

* Advertise:

  ```jsonc
  "capabilities": {
    "logging": {}
  }
  ```
* Implement handler for:

  ```
  method: "logging/setLevel"
  params: {
    level: "<syslog-level>"
  }
  ```
* Emit log messages via:

  ```
  method: "notifications/message"
  params: {
    level: "<syslog-level>",
    logger: "<module or tool name>",
    data: <arbitrary JSON safe for exposure>
  }
  ```

### Supported log levels (per RFC 5424 / MCP):

```
debug
info
notice
warning
error
critical
alert
emergency
```

---

## **4. Internal Logging Architecture**

### **4.1 Logger Interface**

Create `src/logger.ts` with:

* Central `Logger` interface
* `LoggerSink`
* `LogLevel` union
* Level ordering + comparison
* `createLogger(initialLevel: LogLevel = "info")`

The logger must support:

* `logger.log(level, name, data)`
* `logger.debug(name, data)`
* `logger.info(name, data)`
* `logger.warn(name, data)`  → maps to `warning`
* `logger.error(name, data)`
* `logger.setLevel(level)`
* `logger.sendLogMessage(level, name, data)` → will be replaced by MCP server

### **4.2 Logger Behavior**

* Always output to **console** (JSON structured)
* Optionally output to MCP via `notifications/message`
* Apply level filtering before output
* Never log:

  * raw subject IDs
  * tokens
  * security secrets
* Use existing `maskSubjectId` helper before logging

---

## **5. MCP Integration**

Modify `index.sse.ts`:

### 5.1 During server construction

* Instantiate the logger:

  ```ts
  const logger = createLogger(process.env.LOG_LEVEL || "info");
  ```

* Pass logger into the ToolContext via existing `buildToolContextFromMeta`.

### 5.2 Add `logging` capability to `initialize` response

```ts
capabilities: {
  tools: { listChanged: true },
  resources: { subscribe: true },
  prompts: {},
  logging: {},       // <--- new
},
```

### 5.3 Add handler for `logging/setLevel`

Validate incoming level and update:

```ts
server.onRequest("logging/setLevel", async (req) => {
  const level = req.params?.level;
  // validate
  logger.setLevel(level);
  return {};
});
```

### 5.4 Wire logger into MCP notifications

After creating server instance:

```ts
logger.sendLogMessage = (level, loggerName, data) => {
  server.sendNotification("notifications/message", {
    level,
    logger: loggerName,
    data,
  });
};
```

---

## **6. Tool & Store Logging Integration**

### **6.1 ToolContext**

Expand context to include logger:

```ts
export interface ToolContext {
  subjectId: string;
  logger: Logger;
}
```

### **6.2 Tool Usage Example**

Example inside `list_todos`:

```ts
ctx.logger.debug("list_todos", {
  subject: maskSubjectId(ctx.subjectId),
  input,
});

const todos = await store.getTodosBySubject(ctx.subjectId);

ctx.logger.info("list_todos", {
  subject: maskSubjectId(ctx.subjectId),
  count: todos.length,
});
```

### **6.3 Storage Logging**

MemoryStore operations SHOULD log:

* `debug` on read/write
* `error` if write failures or integrity issues occur

---

## **7. Logging Safety & Masking**

All logs must conform to safety guidelines:

* No sensitive values
* Subject IDs masked via `maskSubjectId()`
* Keep payloads small and JSON-safe
* Do not log full todo bodies when not necessary

Example masked payload:

```jsonc
{
  "level": "info",
  "logger": "toggle_todo",
  "data": {
    "subject": "subj_xxx…yyy",
    "todoId": "abc123",
    "newState": true
  }
}
```

---

## **8. Testing Requirements**

### 8.1 Unit Tests

Create tests for:

1. Logger level filtering (debug < info < …)
2. Logger setLevel validation
3. Console log shape (snapshot test acceptable)
4. MCP `logging/setLevel` handler
5. Notification emission:

   * Ensure `server.sendNotification` is called
   * With correct params structure

### 8.2 Integration Tests

Use mock SSE client to verify:

* `initialize` includes `"logging": {}` capability
* Client can call `logging/setLevel`
* Server emits `notifications/message`
* Level filtering works at runtime

---

## **9. Deliverables**

* `src/logger.ts` with full logger implementation
* Updated `index.sse.ts` with logging capability + handlers
* Updated ToolContext + tool modules
* MemoryStore logging
* Unit + integration tests
* Updated documentation in backend spec
