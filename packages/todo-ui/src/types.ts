export type TodoStatus = "pending" | "in_progress" | "done";

export interface Todo {
  id: string;
  subjectId: string;
  title: string;
  notes?: string;
  status: TodoStatus;
  createdAt: string;
  updatedAt: string;
  aiEnrichmentStatus: "not_started" | "queued" | "running" | "complete" | "error";
  aiSummary?: string;
  aiLinks?: { label: string; url: string }[];
  aiLastRunAt?: string;
}

export interface ListTodosOutput {
  todos: Todo[];
}

export type ToolName =
  | "list_todos"
  | "create_todo"
  | "toggle_todo"
  | "delete_todo"
  | "enrich_todo";

export interface OpenAIWindowBridge {
  toolOutput?: unknown;
  onToolOutput?: (cb: (output: unknown) => void) => void | (() => void);
  callTool?: (toolName: string, input: any) => Promise<any>;
}

export type UiState = {
  loading: boolean;
  error: string | null;
  todos: Todo[] | null;
};

export interface ActionError {
  message: string;
  detail?: string;
  toolName?: ToolName;
}

export interface BridgeDiagnostics {
  hasBridge: boolean;
  hasCallTool: boolean;
  hasOnToolOutput: boolean;
}

declare global {
  interface Window {
    openai?: OpenAIWindowBridge;
  }
}

export const isListTodosOutput = (value: unknown): value is ListTodosOutput => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<ListTodosOutput>;
  return Array.isArray(candidate.todos);
};
