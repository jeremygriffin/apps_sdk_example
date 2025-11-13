import { useCallback, useEffect, useMemo, useState } from "react";

import { ErrorBanner } from "./components/ErrorBanner";
import { NewTodoForm } from "./components/NewTodoForm";
import { TodoList } from "./components/TodoList";
import { BridgeBadge } from "./components/BridgeBadge";
import { StatsRow } from "./components/StatsRow";
import { EmptyState } from "./components/EmptyState";
import { LoadingState } from "./components/LoadingState";
import { getBridgeDiagnostics } from "./logger";
import {
  callToolWithLogging,
  ensureOpenAiBridge,
  hydrateFromToolOutput,
  subscribeToToolOutput
} from "./openaiBridge";
import type { ActionError, ListTodosOutput, ToolName, UiState } from "./types";

const DEFAULT_ERROR_MESSAGE = "There was a problem performing that action.";
const INVALID_OUTPUT_MESSAGE = "This view expected a todo list but received something else.";

const clearItemError = (map: Record<string, string>, id: string) => {
  if (!map[id]) return map;
  const next = { ...map };
  delete next[id];
  return next;
};

const updateSet = (set: Set<string>, id: string) => {
  const next = new Set(set);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
};

export const TodoApp = () => {
  const [uiState, setUiState] = useState<UiState>({ loading: true, error: null, todos: null });
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const [softWarning, setSoftWarning] = useState<string | null>(null);
  const [pendingTool, setPendingTool] = useState<ToolName | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [expandedAi, setExpandedAi] = useState<Set<string>>(new Set());
  const [bridgeDiagnostics, setBridgeDiagnostics] = useState(getBridgeDiagnostics);

  const totalTodos = uiState.todos?.length ?? 0;
  const completedTodos = useMemo(
    () => uiState.todos?.filter((todo) => todo.status === "done").length ?? 0,
    [uiState.todos]
  );

  const refresh = useCallback(async () => {
    setUiState((prev) => ({ ...prev, loading: true, error: null }));
    setActionError(null);
    setPendingTool("list_todos");
    try {
      const output = await callToolWithLogging<{}, ListTodosOutput>("list_todos", {});
      setUiState({ loading: false, error: null, todos: output.todos });
      setSoftWarning(null);
      setItemErrors({});
    } catch (error) {
      setUiState((prev) => ({ ...prev, loading: false, error: "Something went wrong." }));
      setActionError({
        message: DEFAULT_ERROR_MESSAGE,
        detail: error instanceof Error ? error.message : String(error),
        toolName: "list_todos"
      });
    } finally {
      setPendingTool(null);
    }
  }, []);

  useEffect(() => {
    const bridge = ensureOpenAiBridge();
    setBridgeDiagnostics(getBridgeDiagnostics());
    const hydrated = hydrateFromToolOutput(
      bridge.toolOutput,
      (output) => {
        setUiState({ loading: false, error: null, todos: output.todos });
        setSoftWarning(null);
      },
      () => {
        setSoftWarning(INVALID_OUTPUT_MESSAGE);
      }
    );

    const unsubscribe = subscribeToToolOutput((output) => {
      hydrateFromToolOutput(
        output,
        (value) => {
          setUiState({ loading: false, error: null, todos: value.todos });
          setSoftWarning(null);
        },
        () => setSoftWarning(INVALID_OUTPUT_MESSAGE)
      );
    });

    if (!hydrated) {
      void refresh();
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [refresh]);

  const runAction = useCallback(
    async (toolName: ToolName, input: Record<string, unknown>, itemId?: string) => {
      setPendingTool(toolName);
      setActionError(null);
      if (itemId) {
        setItemErrors((prev) => clearItemError(prev, itemId));
      }

      try {
        await callToolWithLogging<Record<string, unknown>, unknown>(toolName, input);
        await refresh();
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        setActionError({
          message: DEFAULT_ERROR_MESSAGE,
          detail,
          toolName
        });
        if (itemId) {
          setItemErrors((prev) => ({ ...prev, [itemId]: "Unable to update this todo." }));
        }
      } finally {
        setPendingTool(null);
      }
    },
    [refresh]
  );

  const handleCreate = useCallback(
    async ({ title, notes }: { title: string; notes?: string }) => {
      await runAction(
        "create_todo",
        notes ? { title, notes } : { title }
      );
    },
    [runAction]
  );

  const handleToggle = useCallback((todoId: string) => runAction("toggle_todo", { todoId }, todoId), [runAction]);
  const handleDelete = useCallback((todoId: string) => runAction("delete_todo", { todoId }, todoId), [runAction]);
  const handleEnrich = useCallback((todoId: string) => runAction("enrich_todo", { todoId }, todoId), [runAction]);

  const toggleNotes = useCallback((todoId: string) => {
    setExpandedNotes((prev) => updateSet(prev, todoId));
  }, []);

  const toggleAiDetails = useCallback((todoId: string) => {
    setExpandedAi((prev) => updateSet(prev, todoId));
  }, []);

  const handleDismissActionError = () => setActionError(null);

  const showLoadingState = uiState.loading && !uiState.todos;
  const hasTodos = Boolean(uiState.todos && uiState.todos.length > 0);

  return (
    <div className="todo-shell" data-testid="todo-app">
      <div className="todo-header">
        <h1>Your Todos</h1>
        <p>Scoped to your ChatGPT session.</p>
      </div>
      <BridgeBadge diagnostics={bridgeDiagnostics} />

      {softWarning ? (
        <div className="notice-banner">
          <span>{softWarning}</span>
          <button className="secondary" type="button" onClick={() => void refresh()}>
            Fetch todos
          </button>
        </div>
      ) : null}

      {uiState.error ? (
        <div style={{ marginTop: 16 }}>
          <ErrorBanner
            message={uiState.error}
            detail={actionError?.detail}
            toolName={actionError?.toolName}
            onDismiss={() => setUiState((prev) => ({ ...prev, error: null }))}
          />
          <div style={{ marginTop: 12 }}>
            <button className="secondary" type="button" onClick={() => void refresh()} disabled={pendingTool === "list_todos"}>
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {actionError && !uiState.error ? (
        <div style={{ marginTop: 16 }}>
          <ErrorBanner
            message={actionError.message}
            detail={actionError.detail}
            toolName={actionError.toolName}
            onDismiss={handleDismissActionError}
          />
        </div>
      ) : null}

      <StatsRow
        completed={completedTodos}
        total={totalTodos}
        onRefresh={() => void refresh()}
        refreshing={uiState.loading}
      />

      <NewTodoForm disabled={Boolean(pendingTool)} onCreate={handleCreate} />

      {showLoadingState ? <LoadingState /> : null}

      {!showLoadingState && uiState.todos && uiState.todos.length === 0 ? (
        <EmptyState message="You don't have any todos yet." />
      ) : null}

      {hasTodos && uiState.todos ? (
        <TodoList
          todos={uiState.todos}
          disabled={Boolean(pendingTool)}
          itemErrors={itemErrors}
          expandedNotes={expandedNotes}
          expandedAi={expandedAi}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onEnrich={handleEnrich}
          toggleNotes={toggleNotes}
          toggleAiDetails={toggleAiDetails}
        />
      ) : null}
    </div>
  );
};
