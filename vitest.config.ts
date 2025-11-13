import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  test: {
    include: ["src/test/**/*.test.ts", "test/**/*.test.ts", "packages/todo-ui/src/**/*.test.tsx"],
    environment: "node",
    setupFiles: ["packages/todo-ui/vitest.setup.ts"],
    coverage: {
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}", "packages/todo-ui/src/**/*.{ts,tsx}"]
    }
  }
});
