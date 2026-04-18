import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      include: ["src/shared/**/*.ts"],
      exclude: ["src/shared/**/*.test.ts"],
      reporter: ["text", "html"],
    },
  },
});
