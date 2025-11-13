import { defineConfig, defineProject } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}", "packages/todo-ui/src/**/*.{ts,tsx}"]
    },
    projects: [
      defineProject({
        test: {
          name: "backend",
          environment: "node",
          include: ["test/**/*.test.ts"]
        }
      }),
      defineProject({
        test: {
          name: "frontend",
          environment: "jsdom",
          include: ["packages/todo-ui/src/**/*.test.tsx"],
          setupFiles: ["packages/todo-ui/vitest.setup.ts"]
        }
      })
    ]
  }
});
