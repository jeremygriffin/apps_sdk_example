import { FormEvent, useState } from "react";

interface NewTodoFormProps {
  disabled?: boolean;
  onCreate: (input: { title: string; notes?: string }) => Promise<void> | void;
}

export const NewTodoForm = ({ disabled, onCreate }: NewTodoFormProps) => {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }
    await onCreate({ title: title.trim(), notes: notes.trim() ? notes.trim() : undefined });
    setTitle("");
    setNotes("");
  };

  return (
    <form className="new-todo" data-testid="new-todo-form" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="title-input">Title</label>
        <input
          id="title-input"
          name="title"
          placeholder="Add a todo"
          value={title}
          disabled={disabled}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="notes-input">Notes (optional)</label>
        <textarea
          id="notes-input"
          name="notes"
          placeholder="Add more context"
          value={notes}
          disabled={disabled}
          rows={3}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" disabled={disabled || !title.trim()}>
          Add todo
        </button>
      </div>
    </form>
  );
};
