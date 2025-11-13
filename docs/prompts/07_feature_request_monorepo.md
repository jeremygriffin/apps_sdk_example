# Feature Request: Refactor to Monorepo Structure

## Overview

During a recent code review, it was observed that the `todo-ui` package, while functionally integrated, does not adhere to a standard monorepo structure. Its dependencies are currently declared in the root `package.json`, which is an unconventional approach for managing multiple distinct packages within a single repository.

This feature request proposes refactoring the project to a proper monorepo setup, where each package (e.g., `todo-ui`, the backend) has its own `package.json` and manages its dependencies independently. This would typically involve using workspace features provided by package managers like npm, yarn, or pnpm.

## Motivation

The current setup, while functional, presents several challenges:

*   **Lack of Clear Dependency Separation**: It is difficult to discern which dependencies belong to the backend and which belong to the frontend, leading to potential confusion and maintenance overhead.
*   **Scalability Issues**: As the project grows and more packages are introduced, a single, monolithic `package.json` will become increasingly bloated and harder to manage.
*   **Increased Risk of Version Conflicts**: Managing all dependencies in one file increases the likelihood of version conflicts between packages that might require different versions of the same dependency.
*   **Reduced Maintainability**: The lack of clear boundaries between package dependencies makes it harder to update, audit, or remove specific package dependencies without affecting others.
*   **Non-Standard Practice**: Deviating from standard monorepo practices can make it harder for new developers to onboard and understand the project structure.

## Proposed Changes

1.  **Create `package.json` for `todo-ui`**: A new `package.json` file should be created within the `packages/todo-ui/` directory.
2.  **Migrate Frontend Dependencies**: All dependencies currently listed in the root `package.json` that are specific to the `todo-ui` package (e.g., `react`, `react-dom`, `@vitejs/plugin-react`, `vite`, `@testing-library/react`, `jsdom`, etc.) should be moved to `packages/todo-ui/package.json`.
3.  **Configure Workspaces**: The root `package.json` should be configured to use a workspace feature (e.g., `npm workspaces`, `yarn workspaces`, or `pnpm workspaces`) to manage the `packages/` directory. This will allow for hoisting common dependencies and managing inter-package dependencies effectively.
4.  **Update Build and Test Scripts**: Adjust any build, test, or development scripts (e.g., in `package.json` and `vitest.config.ts`) to correctly reference the new package structure and its dependencies.

## Benefits

*   **Improved Clarity**: Clear separation of concerns and dependencies for each package.
*   **Enhanced Scalability**: Easier to add new packages and manage their dependencies independently.
*   **Reduced Conflicts**: Minimizes dependency version conflicts between different parts of the application.
*   **Better Maintainability**: Simplifies dependency management, updates, and auditing for individual packages.
*   **Standardization**: Aligns the project with common monorepo best practices, making it more approachable for new contributors.

## Acceptance Criteria

*   [ ] `packages/todo-ui/package.json` exists and contains all `todo-ui`-specific dependencies.
*   [ ] The root `package.json` is configured to use workspaces and only contains root-level or shared development dependencies.
*   [ ] All build, test, and development scripts function correctly with the new monorepo structure.
*   [ ] The project can be successfully installed and built from a clean state.
*   [ ] No regressions are introduced in existing backend or frontend functionality.

---

## Additional Recommendations

### Stricter Error Handling in `configLoader.ts`

The `readEnvJson` function in `configLoader.ts` currently logs a warning and returns an empty object if it fails to parse the `env.json` file. This could allow the application to start with a partial or incorrect configuration, masking a potentially critical issue.

**Recommendation**: Modify the `readEnvJson` function to re-throw the error when `JSON.parse()` fails. This will cause the application to fail on startup, making configuration errors immediately apparent and preventing the server from running in an unpredictable state.