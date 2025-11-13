import { randomUUID } from "node:crypto";

import { TodoNotFoundError } from "../errors";
import { logger, Logger, maskSubjectId } from "../logger";
import { nowIsoString } from "../utils/datetime";
import { AiLink, Todo, TodoUpdateFields } from "../types/todo";
import { Store } from "./index";

interface MemoryStoreOptions {
  log?: Logger;
}

type SubjectMap = Map<string, Map<string, Todo>>;

const cloneTodo = (todo: Todo): Todo => JSON.parse(JSON.stringify(todo));

export const createMemoryStore = (options: MemoryStoreOptions = {}): Store => {
  const subjects: SubjectMap = new Map();
  const log = options.log ?? logger;

  const ensureSubjectStore = (subjectId: string): Map<string, Todo> => {
    if (!subjects.has(subjectId)) {
      subjects.set(subjectId, new Map());
    }
    return subjects.get(subjectId)!;
  };

  const findTodoOrThrow = (subjectId: string, todoId: string): Todo => {
    const subjectStore = ensureSubjectStore(subjectId);
    const todo = subjectStore.get(todoId);
    if (!todo) {
      throw new TodoNotFoundError(subjectId, todoId);
    }
    return todo;
  };

  const logDebug = (message: string, context: Record<string, unknown>) => {
    log.debug(message, context);
  };

  return {
    async getTodosBySubject(subjectId: string): Promise<Todo[]> {
      const subjectStore = ensureSubjectStore(subjectId);
      const todos = Array.from(subjectStore.values()).sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      );
      logDebug("getTodosBySubject", {
        subject: maskSubjectId(subjectId),
        count: todos.length
      });
      return todos.map(cloneTodo);
    },

    async getTodoById(subjectId: string, todoId: string): Promise<Todo | null> {
      const subjectStore = ensureSubjectStore(subjectId);
      const todo = subjectStore.get(todoId) ?? null;
      logDebug("getTodoById", {
        subject: maskSubjectId(subjectId),
        todoId,
        found: Boolean(todo)
      });
      return todo ? cloneTodo(todo) : null;
    },

    async createTodo(subjectId: string, data: { title: string; notes?: string }): Promise<Todo> {
      const subjectStore = ensureSubjectStore(subjectId);
      const id = randomUUID();
      const timestamp = nowIsoString();
      const todo: Todo = {
        id,
        subjectId,
        title: data.title,
        notes: data.notes,
        status: "pending",
        createdAt: timestamp,
        updatedAt: timestamp,
        aiEnrichmentStatus: "not_started"
      };
      subjectStore.set(id, todo);
      logDebug("createTodo", {
        subject: maskSubjectId(subjectId),
        todoId: id
      });
      return cloneTodo(todo);
    },

    async updateTodo(subjectId: string, todoId: string, updates: TodoUpdateFields): Promise<Todo> {
      const todo = findTodoOrThrow(subjectId, todoId);
      if (updates.title !== undefined) {
        todo.title = updates.title;
      }
      if (updates.notes !== undefined) {
        todo.notes = updates.notes;
      }
      if (updates.status !== undefined) {
        todo.status = updates.status;
      }
      todo.updatedAt = nowIsoString();
      logDebug("updateTodo", {
        subject: maskSubjectId(subjectId),
        todoId
      });
      return cloneTodo(todo);
    },

    async deleteTodo(subjectId: string, todoId: string): Promise<void> {
      const subjectStore = ensureSubjectStore(subjectId);
      if (!subjectStore.delete(todoId)) {
        throw new TodoNotFoundError(subjectId, todoId);
      }
      logDebug("deleteTodo", {
        subject: maskSubjectId(subjectId),
        todoId
      });
    },

    async toggleTodoStatus(subjectId: string, todoId: string): Promise<Todo> {
      const todo = findTodoOrThrow(subjectId, todoId);
      todo.status = todo.status === "done" ? "pending" : "done";
      todo.updatedAt = nowIsoString();
      logDebug("toggleTodoStatus", {
        subject: maskSubjectId(subjectId),
        todoId,
        status: todo.status
      });
      return cloneTodo(todo);
    },

    async updateTodoEnrichment(
      subjectId: string,
      todoId: string,
      enrichment: {
        status: Todo["aiEnrichmentStatus"];
        summary?: string;
        links?: AiLink[];
        lastRunAt?: string;
      }
    ): Promise<Todo> {
      const todo = findTodoOrThrow(subjectId, todoId);
      todo.aiEnrichmentStatus = enrichment.status;
      todo.aiSummary = enrichment.summary;
      todo.aiLinks = enrichment.links;
      todo.aiLastRunAt = enrichment.lastRunAt;
      todo.updatedAt = nowIsoString();
      logDebug("updateTodoEnrichment", {
        subject: maskSubjectId(subjectId),
        todoId,
        status: enrichment.status
      });
      return cloneTodo(todo);
    }
  } satisfies Store;
};
