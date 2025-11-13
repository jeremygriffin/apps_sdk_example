### Overall Assessment

The changes are of high quality, with good attention to detail, testing, and adherence to the project's conventions. The new "annotations" feature is well-implemented, and the refactoring improves the project structure.

### Recommendations

Here are a few recommendations for improvement:

1.  **Investigate Type Casting in `src/toolRegistry.ts`**:
    In `src/toolRegistry.ts`, the `tools` array creation uses `as unknown as ToolDefinition<ZodTypeAny, ZodTypeAny>[]`. This type of casting can hide underlying type mismatches. I recommend investigating why this cast is necessary and resolving the root type incompatibility if possible. This will improve the long-term maintainability and type safety of the code.

2.  **Consider Path Aliases for Imports (Optional)**:
    With the test files moved to `src/test`, imports are now relative, like `import { createLogger } from "../../logger";`. To make these imports cleaner and less brittle to future file moves, you could consider setting up path aliases in `tsconfig.json`. For example, you could define an alias `@/*` that points to `src/*`, allowing you to write imports like `import { createLogger } from "@/logger";`. This is a suggestion for future improvement and not a critical issue.

Other than these points, the changes look solid. The new feature is well-tested, and the refactoring is clean.

---

### Review of Commit: `feat(prompts): add annotation-aware planning`

#### Commit Summary

The commit `470fe11fe8ff55754740ae469fdd310dc521ae8c` titled `feat(prompts): add annotation-aware planning` introduces the following:

1.  **Updated `prioritize_todos` prompt**:
    *   The description is updated to reflect the use of annotations (`priority`, `complexity`, `marker`).
    *   The `arguments` for `prioritize_todos` are changed:
        *   `todosJson` description is updated to mention annotations.
        *   `maxFocusItems` is replaced with `timeframe` (enum: `today`, `this_week`, `later`).
    *   The `system` message is significantly expanded to provide detailed instructions to the LLM on how to use annotations for prioritization, including identifying quick wins, deep work, and strategic items.
    *   The `user` message is updated to reflect the new `timeframe` argument.
    *   The expected JSON output structure is also updated to include `ordered`, `quickWins`, `deepWork`, and `strategic` arrays, along with `recommendations`.

2.  **New `summarize_todo_load` prompt**:
    *   A new prompt is added to `src/prompts/promptRegistry.ts`.
    *   **Description**: "Summarize the user’s workload by grouping todos into buckets using their annotations."
    *   **Arguments**: `todosJson` (JSON array of todos with annotations).
    *   **Messages**: Provides detailed `system` instructions for summarizing workload using annotation-aware buckets (Top Priority, Quick Wins, Deep Work, Maintenance/Routine, Attention Needed). It also defines the expected JSON output structure including `summary`, `buckets`, `recommendations`, and `risks`.

3.  **Updated `src/test/prompts/promptRegistry.test.ts`**:
    *   The `prompts` array in the test now includes `summarize_todo_load`.
    *   New tests are added for `prioritize_todos` to validate the `timeframe` enum.
    *   A new test is added to ensure the `summarize_todo_load` prompt renders correctly with a `todosJson` placeholder.

#### Recommendations

1.  **Consistency in Prompt Argument Naming (`todosJson`)**: Reinforce consistent use of `todosJson` for all prompts expecting a JSON array of todos, ensuring similar descriptions for clarity.
2.  **Detailed Example for `todosJson` in Prompt Descriptions**: Enhance the `todosJson` argument's description with a small, illustrative JSON snippet to immediately clarify the expected structure, especially for new annotation fields.
3.  **Consider a Shared Type/Schema for Prompt Output Structures**: For future robustness and type safety, define Zod schemas for the complex JSON output structures described in prompt system messages. This would enable validation and provide clear documentation.
4.  **Test Coverage for Output Structure (Future)**: If shared output schemas are implemented, add tests to verify that the expected output structure communicated in the prompt's system message aligns with the defined Zod schema.