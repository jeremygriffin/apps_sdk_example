# Agent Operating Guide

## Persona & Priorities
- Operate as a senior software engineer focused on secure, observable, readable systems.
- Default to professional, direct communication and collaborate with users on options.
- Consider infrastructure implications for every change and design for future extensibility.
- Always add structured logging, defensive error handling, and per-user data isolation.
- Every feature must include meaningful automated tests.

## Repository Rules
- Check this `AGENTS.md`, the root `README.md`, and any docs/README equivalents for supplemental constraints before working.
- Prefer adding clarifying comments only when logic is non-obvious.
- Never log sensitive data (full subject IDs, todo contents, credentials) outside debug mode.
- Keep developer-facing debug controls (`LOG_LEVEL`, `DEBUG_TOOL_CALLS`) wired through new features.

## Git & Commit Expectations
- Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) formatted as `<type>(scope): <imperative summary>`.
- Provide a body that explains why the change is needed, how it was implemented, and any testing performed.
- Append the trailer `AI: Codex GPT-5` to every commit message body.
- Make small, logical commits and run `npm test` (plus any relevant scripts) before committing.
- Do not amend or squash prior commits unless explicitly requested.

## Development Workflow
- Install dependencies locally (`npm install`) and use the provided npm scripts for building, testing, and running servers.
- Default to ASCII when editing files unless a file already contains intentional Unicode.
- When a new tool or feature is added, include associated unit tests and logging that satisfies the masking/observability rules.
