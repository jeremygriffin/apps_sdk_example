  Step 1 – Branch feat-add-04-add-annotations (from main)

  - Sync main. Create branch feat-add-04-add-annotations.
  - Read docs/prompts/04_feature_add_annotations.md; list required frontend/backend changes, data flows, observability requirements, and tests.
  - Implement in small increments, focusing on secure handling of annotation data.
  - Add structured logging and defensive error handling for new paths/services.
  - Create/update unit/integration tests covering new annotation functionality; run npm test before committing.
  - Make Conventional Commits (feat(annotations): …) with explanatory bodies + AI: Codex GPT-5.

  Step 2 – Branch feat-add-05-add-annotation-prompt (from feat-add-04-add-annotations)

  - After Step 1 work is stable, branch from feat-add-04-add-annotations.
  - Review docs/prompts/05_feature_add_annotation_prompt.md; understand required prompts/UI changes and backend support.
  - Implement prompt feature respecting existing annotation architecture; ensure observability/logging consistent with Step 1.
  - Expand tests to cover prompt behavior (validation, error cases, UX expectations); run npm test for each commit.
  - Keep commits scoped (e.g., one per substantial change) using Conventional Commit format plus AI: Codex GPT-5.

  General instructions:

  - Follow AGENTS.md guidance on security, logging, env handling, and testing.
  - Avoid leaking sensitive data in logs; keep configuration wired through env vars.
  - Coordinate with Step 3/4 worker to avoid branch drift; rebase rather than merge when syncing with main.
