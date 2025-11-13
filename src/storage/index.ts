import { AiLink, Todo, TodoUpdateFields } from "../types/todo";

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
    updates: TodoUpdateFields
  ): Promise<Todo>;
  deleteTodo(subjectId: string, todoId: string): Promise<void>;
  toggleTodoStatus(subjectId: string, todoId: string): Promise<Todo>;
  updateTodoEnrichment(
    subjectId: string,
    todoId: string,
    enrichment: {
      status: Todo["aiEnrichmentStatus"];
      summary?: string;
      links?: AiLink[];
      lastRunAt?: string;
    }
  ): Promise<Todo>;
}

export type StoreFactory<TStore extends Store = Store> = () => TStore;
