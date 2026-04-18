import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false, // Single persistent context per test — don't parallelise.
  retries: 0,
  reporter: [["list"]],
  use: {
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
});
