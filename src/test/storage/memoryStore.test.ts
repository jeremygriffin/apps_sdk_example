import { beforeEach, describe, expect, it } from "vitest";

import { TodoNotFoundError } from "../../errors";
import { createMemoryStore } from "../../storage/memoryStore";
import { createSilentLogger } from "../helpers/logger";

describe("memoryStore", () => {
  let store = createMemoryStore({ log: createSilentLogger() });

  beforeEach(() => {
    store = createMemoryStore({ log: createSilentLogger() });
  });

  it("isolates todos by subject", async () => {
    await store.createTodo("subject-a", { title: "Write docs" });
    await store.createTodo("subject-b", { title: "Ship feature" });

    const subjectATodos = await store.getTodosBySubject("subject-a");
    const subjectBTodos = await store.getTodosBySubject("subject-b");

    expect(subjectATodos).toHaveLength(1);
    expect(subjectATodos[0].subjectId).toBe("subject-a");
    expect(subjectBTodos).toHaveLength(1);
    expect(subjectBTodos[0].subjectId).toBe("subject-b");
  });

  it("supports CRUD operations", async () => {
    const created = await store.createTodo("subject-a", {
      title: "Draft proposal",
      notes: "Focus on MCP"
    });

    const fetched = await store.getTodoById("subject-a", created.id);
    expect(fetched?.title).toBe("Draft proposal");

    await store.updateTodo("subject-a", created.id, {
      title: "Draft updated proposal",
      status: "in_progress",
      priority: 5,
      complexity: 2,
      marker: "diamond"
    });

    const updated = await store.getTodoById("subject-a", created.id);
    expect(updated?.title).toBe("Draft updated proposal");
    expect(updated?.status).toBe("in_progress");
    expect(updated?.priority).toBe(5);
    expect(updated?.complexity).toBe(2);
    expect(updated?.marker).toBe("diamond");

    const toggled = await store.toggleTodoStatus("subject-a", created.id);
    expect(toggled.status).toBe("done");

    await store.deleteTodo("subject-a", created.id);
    const afterDelete = await store.getTodoById("subject-a", created.id);
    expect(afterDelete).toBeNull();
  });

  it("updates enrichment data", async () => {
    const created = await store.createTodo("subject-a", { title: "Enrich me" });

    const enriched = await store.updateTodoEnrichment("subject-a", created.id, {
      status: "complete",
      summary: "Simulated summary",
      links: [{ label: "Docs", url: "https://example.com" }],
      lastRunAt: "2024-01-01T00:00:00.000Z"
    });

    expect(enriched.aiEnrichmentStatus).toBe("complete");
    expect(enriched.aiSummary).toBe("Simulated summary");
    expect(enriched.aiLinks).toHaveLength(1);
  });

  it("throws on missing todos", async () => {
    await expect(
      store.updateTodo("subject-a", "missing", { title: "Nope" })
    ).rejects.toBeInstanceOf(TodoNotFoundError);
  });
});
