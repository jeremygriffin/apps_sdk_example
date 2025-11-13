import { defineConfig, defineProject } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: "backend",
          environment: "node",
          include: ["test/**/*.test.ts"],
          coverage: {
            reporter: ["text", "lcov"],
            include: ["src/**/*.{ts,tsx}"]
          }
        }
      }),
      defineProject({
        test: {
          name: "frontend",
          environment: "jsdom",
          include: ["packages/todo-ui/src/**/*.test.tsx"],
          setupFiles: ["packages/todo-ui/vitest.setup.ts"],
          coverage: {
            reporter: ["text", "lcov"],
            include: ["packages/todo-ui/src/**/*.{ts,tsx}"]
          }
        }
      })
    ]
  }
});
