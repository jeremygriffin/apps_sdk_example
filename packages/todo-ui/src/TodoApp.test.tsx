import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { TodoApp } from "./TodoApp";
import type { ListTodosOutput, OpenAIWindowBridge } from "./types";

const createTestTodos = (): ListTodosOutput => ({
  todos: [
    {
      id: "todo-1",
      subjectId: "subject",
      title: "Test todo",
      notes: "note",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiEnrichmentStatus: "complete",
      aiSummary: "summary",
      aiLinks: [{ label: "link", url: "https://example.com" }]
    }
  ]
});

const installBridge = (overrides: Partial<OpenAIWindowBridge> = {}) => {
  const listeners = new Set<(output: unknown) => void>();
  const bridge: OpenAIWindowBridge = {
    toolOutput: overrides.toolOutput,
    callTool:
      overrides.callTool ??
      vi.fn().mockImplementation((name: string) => {
        if (name === "list_todos") {
          return Promise.resolve(createTestTodos());
        }
        return Promise.resolve({ ok: true });
      }),
    onToolOutput:
      overrides.onToolOutput ??
      ((cb: (output: unknown) => void) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      })
  };

  window.openai = bridge;

  const emit = (output: unknown) => {
    bridge.toolOutput = output;
    for (const cb of listeners) {
      cb(output);
    }
  };

  return { bridge, emit };
};

beforeEach(() => {
  window.openai = undefined;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.openai = undefined;
});

describe.sequential("TodoApp", () => {
  test("shows loading state when fetching", () => {
    const pending = new Promise(() => {});
    installBridge({
      toolOutput: undefined,
      callTool: vi.fn().mockReturnValue(pending)
    });

    render(<TodoApp />);

    expect(screen.getByText(/Loading todos/)).toBeInTheDocument();
  });

  test("renders empty state when no todos", () => {
    installBridge({ toolOutput: { todos: [] } });

    render(<TodoApp />);

    expect(screen.getByText(/You don't have any todos yet/)).toBeInTheDocument();
  });

  test("renders todo list and AI details", async () => {
    installBridge({ toolOutput: createTestTodos() });

    render(<TodoApp />);

    expect(screen.getAllByTestId("todo-item")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /Show AI details/i }));
    expect(screen.getByText(/summary/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /link/i })).toHaveAttribute("href", "https://example.com");
  });

  test("creates a todo via the form", async () => {
    const callTool = vi.fn().mockImplementation((name: string) => {
      if (name === "list_todos") {
        return Promise.resolve({ todos: [] });
      }
      return Promise.resolve({ ok: true });
    });

    installBridge({ toolOutput: { todos: [] }, callTool });

    expect(window.openai?.toolOutput).toEqual({ todos: [] });

    render(<TodoApp />);

    expect(window.openai?.toolOutput).toEqual({ todos: [] });

    const [form] = screen.getAllByTestId("new-todo-form");
    await userEvent.type(within(form).getByLabelText(/Title/i), "Write docs");
    await userEvent.click(within(form).getByRole("button", { name: /Add todo/i }));

    await waitFor(() => {
      expect(callTool).toHaveBeenCalledWith("create_todo", { title: "Write docs" });
    });

    await waitFor(() => {
      expect(callTool).toHaveBeenCalledWith("list_todos", {});
    });
  });

  test("handles toggle errors with banner and inline message", async () => {
    const callTool = vi.fn().mockImplementation((name: string) => {
      if (name === "toggle_todo") {
        return Promise.reject(new Error("failed"));
      }
      return Promise.resolve(createTestTodos());
    });

    installBridge({ toolOutput: createTestTodos(), callTool });

    render(<TodoApp />);

    await userEvent.click(screen.getByRole("checkbox"));

    await waitFor(() => {
      expect(screen.getByTestId("error-banner")).toBeInTheDocument();
    });
    expect(screen.getByText(/Unable to update this todo/)).toBeInTheDocument();
  });

  test("shows fetch notice when initial tool output invalid", async () => {
    const callTool = vi.fn().mockResolvedValue({ todos: [] });
    installBridge({ toolOutput: { ok: true }, callTool });

    render(<TodoApp />);

    const fetchButton = await screen.findByRole("button", { name: /Fetch todos/i });
    await userEvent.click(fetchButton);

    await waitFor(() => {
      expect(callTool).toHaveBeenCalledWith("list_todos", {});
    });
  });

  test("refresh button triggers list_todos", async () => {
    const callTool = vi.fn().mockResolvedValue(createTestTodos());
    installBridge({ toolOutput: createTestTodos(), callTool });

    render(<TodoApp />);

    const [statsRow] = screen.getAllByTestId("stats-row");
    await userEvent.click(within(statsRow).getByRole("button", { name: /^Refresh$/i }));

    await waitFor(() => {
      expect(callTool).toHaveBeenCalledWith("list_todos", {});
    });
  });
});
