import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  use: {
    baseURL: "http://127.0.0.1:5176",
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command: "npm.cmd run web",
      cwd: "..",
      port: 5175,
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: "npm.cmd run dev",
      port: 5176,
      reuseExistingServer: true,
      timeout: 120_000
    }
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ]
});
