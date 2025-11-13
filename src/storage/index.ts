import { Logger } from "../logger";
import { AiLink, Todo, TodoUpdateFields } from "../types/todo";

export interface Store {
  getTodosBySubject(subjectId: string, logger?: Logger): Promise<Todo[]>;
  getTodoById(subjectId: string, todoId: string, logger?: Logger): Promise<Todo | null>;
  createTodo(
    subjectId: string,
    data: { title: string; notes?: string },
    logger?: Logger
  ): Promise<Todo>;
  updateTodo(
    subjectId: string,
    todoId: string,
    updates: TodoUpdateFields,
    logger?: Logger
  ): Promise<Todo>;
  deleteTodo(subjectId: string, todoId: string, logger?: Logger): Promise<void>;
  toggleTodoStatus(subjectId: string, todoId: string, logger?: Logger): Promise<Todo>;
  updateTodoEnrichment(
    subjectId: string,
    todoId: string,
    enrichment: {
      status: Todo["aiEnrichmentStatus"];
      summary?: string;
      links?: AiLink[];
      lastRunAt?: string;
    },
    logger?: Logger
  ): Promise<Todo>;
}

export type StoreFactory<TStore extends Store = Store> = () => TStore;
