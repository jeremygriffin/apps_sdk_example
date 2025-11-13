import { describe, expect, it } from "vitest";

import {
  getPromptByName,
  getPromptCatalog,
  normalizePromptArguments,
  PromptArgumentError,
  prompts,
  renderPromptMessage
} from "../../src/prompts/promptRegistry";

describe("prompt registry", () => {
  it("exposes all expected prompt names", () => {
    const names = prompts.map((prompt) => prompt.name);
    expect(names).toEqual([
      "brain_dump_to_todos",
      "summarize_todos",
      "prioritize_todos",
      "clarify_todo",
      "suggest_subtasks"
    ]);
  });

  it("returns catalog entries with matching descriptions", () => {
    const catalog = getPromptCatalog();
    expect(catalog).toHaveLength(prompts.length);
    catalog.forEach((entry) => {
      const prompt = getPromptByName(entry.name);
      expect(prompt?.description).toBe(entry.description);
    });
  });

  it("normalizes required arguments", () => {
    const prompt = getPromptByName("clarify_todo");
    expect(prompt).toBeDefined();
    const normalized = normalizePromptArguments(prompt!, {
      title: "Ship status email"
    });
    expect(normalized).toEqual({ title: "Ship status email" });
  });

  it("accepts valid enum values and rejects invalid ones", () => {
    const prompt = getPromptByName("brain_dump_to_todos");
    expect(prompt).toBeDefined();
    const normalized = normalizePromptArguments(prompt!, {
      dump: "Finish taxes",
      timeframe: "today"
    });
    expect(normalized.timeframe).toBe("today");
    expect(() =>
      normalizePromptArguments(prompt!, {
        dump: "Finish taxes",
        timeframe: "next_month"
      })
    ).toThrow(PromptArgumentError);
  });

  it("throws when required arguments are missing", () => {
    const prompt = getPromptByName("prioritize_todos");
    expect(prompt).toBeDefined();
    expect(() => normalizePromptArguments(prompt!, {})).toThrow(PromptArgumentError);
  });

  it("renders prompt messages with placeholder substitution", () => {
    const prompt = getPromptByName("summarize_todos");
    expect(prompt).toBeDefined();
    const args = {
      todosJson: '[{"title":"Sample","status":"pending"}]',
      timeframe: "today"
    };
    const rendered = renderPromptMessage(prompt!.messages[1], args);
    expect(rendered).toContain(args.todosJson);
    expect(rendered).toContain(args.timeframe);
  });
});
