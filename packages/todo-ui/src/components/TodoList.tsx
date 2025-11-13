import type { Todo } from "../types";

interface TodoListProps {
  todos: Todo[];
  disabled?: boolean;
  itemErrors: Record<string, string | undefined>;
  expandedNotes: Set<string>;
  expandedAi: Set<string>;
  onToggle: (todoId: string) => void;
  onDelete: (todoId: string) => void;
  onEnrich: (todoId: string) => void;
  toggleNotes: (todoId: string) => void;
  toggleAiDetails: (todoId: string) => void;
}

const statusClass: Record<Todo["status"], string> = {
  pending: "badge pending",
  in_progress: "badge in_progress",
  done: "badge done"
};

const enrichmentLabel: Record<Todo["aiEnrichmentStatus"], string> = {
  not_started: "Enrich",
  queued: "Queued",
  running: "Running",
  complete: "Refresh enrichment",
  error: "Retry enrichment"
};

const isEnrichmentDisabled = (status: Todo["aiEnrichmentStatus"]) =>
  status === "running" || status === "queued";

const AiBadgeClass: Record<Todo["aiEnrichmentStatus"], string> = {
  not_started: "badge enrichment",
  queued: "badge enrichment",
  running: "badge enrichment",
  complete: "badge enrichment",
  error: "badge enrichment"
};

const formatLabel = (value: string) => value.replace(/_/g, " ");

export const TodoList = ({
  todos,
  disabled,
  itemErrors,
  expandedNotes,
  expandedAi,
  onToggle,
  onDelete,
  onEnrich,
  toggleNotes,
  toggleAiDetails
}: TodoListProps) => {
  return (
    <div className="todo-list">
      {todos.map((todo) => {
        const showNotes = Boolean(todo.notes) && expandedNotes.has(todo.id);
        const showAiDetails = expandedAi.has(todo.id);

        return (
          <article
            className="todo-item"
            key={todo.id}
            data-testid="todo-item"
            data-id={todo.id}
          >
            <div className="todo-item-header">
              <label style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
                <input
                  type="checkbox"
                  checked={todo.status === "done"}
                  onChange={() => onToggle(todo.id)}
                  disabled={disabled}
                />
                <div>
                  <div>{todo.title}</div>
                  <div className={statusClass[todo.status]}>{formatLabel(todo.status)}</div>
                </div>
              </label>
              <span className={AiBadgeClass[todo.aiEnrichmentStatus]}>
                {formatLabel(todo.aiEnrichmentStatus)}
              </span>
            </div>
            {todo.notes ? (
              <button
                className="secondary"
                type="button"
                onClick={() => toggleNotes(todo.id)}
                disabled={disabled}
              >
                {showNotes ? "Hide notes" : "Show notes"}
              </button>
            ) : null}
            {showNotes ? <div className="notes-panel">{todo.notes}</div> : null}
            {todo.aiSummary || (todo.aiLinks && todo.aiLinks.length > 0) ? (
              <button
                className="secondary"
                type="button"
                onClick={() => toggleAiDetails(todo.id)}
                disabled={disabled}
              >
                {showAiDetails ? "Hide AI details" : "Show AI details"}
              </button>
            ) : null}
            {showAiDetails ? (
              <div className="ai-details">
                {todo.aiSummary ? <p>{todo.aiSummary}</p> : null}
                {todo.aiLinks && todo.aiLinks.length > 0 ? (
                  <ul className="ai-links">
                    {todo.aiLinks.map((link) => (
                      <li key={link.url}>
                        <a href={link.url} target="_blank" rel="noreferrer">
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            <div className="todo-item-actions">
              <button
                className="secondary"
                type="button"
                onClick={() => onEnrich(todo.id)}
                disabled={disabled || isEnrichmentDisabled(todo.aiEnrichmentStatus)}
              >
                {enrichmentLabel[todo.aiEnrichmentStatus]}
              </button>
              <button className="secondary" type="button" onClick={() => onDelete(todo.id)} disabled={disabled}>
                Delete
              </button>
            </div>
            {itemErrors[todo.id] ? <div className="inline-error">{itemErrors[todo.id]}</div> : null}
          </article>
        );
      })}
    </div>
  );
};
