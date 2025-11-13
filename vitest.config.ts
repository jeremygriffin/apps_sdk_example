import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/test/**/*.test.ts", "test/**/*.test.ts", "packages/todo-ui/src/**/*.test.tsx"],
    environment: "node",
    environmentMatchGlobs: [["packages/todo-ui/**/*.test.tsx", "jsdom"]],
    setupFiles: ["packages/todo-ui/vitest.setup.ts"],
    coverage: {
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}", "packages/todo-ui/src/**/*.{ts,tsx}"]
    }
  }
});
