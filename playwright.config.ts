import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
const edge =
  "C:/Program Files (x86)/Microsoft/EdgeCore/155.0.4283.62/msedge.exe";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173/my-friend-driver/",
    ...devices["iPhone 13"],
    defaultBrowserType: "chromium",
    launchOptions:
      process.platform === "win32" && existsSync(edge)
        ? { executablePath: edge }
        : {},
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/my-friend-driver/",
    reuseExistingServer: !process.env.CI,
  },
});
