import { defineConfig, devices } from "@playwright/test";

delete process.env.NO_COLOR;

const webServer =
  process.env.PLAYWRIGHT_MANAGED_SERVER === "1"
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: "http://127.0.0.1:5173",
      };

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: process.env.CI ? "github" : "list",
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  ...(webServer ? { webServer } : {}),
});
