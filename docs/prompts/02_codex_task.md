 Step 3 – Branch feat-add-02-display-frontend-implementation (from main)

  - Read docs/prompts/02_display_frontend_implementation.md carefully; note required components, observability/logging, and tests.
  - Create branch from up-to-date main.
  - Implement feature following repo standards: structured logging, defensive error handling, per-user data isolation, env-driven config if already mentioned, etc.
  - Add/adjust automated tests that cover new functionality; run npm test before each commit.
  - Make small conventional commits (e.g., feat(display): ...); include body explaining why/how/testing; append AI: Codex GPT-5.

  Step 4 – Branch feat-server-single-port (from feat-add-02-display-frontend-implementation)

  - Goal: server runs on a single port (default 3001) with two routes under same server; host/port configurable via environment (e.g., env.json, process.env fallback).
  - Steps:
      1. From feat-add-02-display-frontend-implementation, create new branch.
      2. Identify current multi-port setup; refactor so both endpoints register on one Express (or equivalent) app.
      3. Introduce configuration loader (reads env.json if present, overrides with process.env); ensure safe defaults and validation/logging of config without leaking sensitive
         data.
      4. Update startup scripts/docs to explain new env vars and default port.
      5. Adjust any client/frontend code or tests to point to the unified port.
      6. Add/extend automated tests covering new config behavior and both routes.
      7. Run full test suite; ensure logging level controllable via existing env vars.
      8. Commit incrementally with Conventional Commits + AI: Codex GPT-5.

  General notes for both steps:

  - Follow AGENTS.md, README, and prompt instructions.
  - Keep commits scoped and logical.
  - Coordinate with other worker (me) to avoid conflicts; rebase as needed but do not amend others’ commits.
  - Do not start until your workspace tracks the correct base branch.
