import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
  webServer: [
    {
      command:
        "python scripts/preview.py --root apps/admin-web/dist --port 5173",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: "python scripts/preview.py --root apps/mobile/dist --port 8082",
      url: "http://127.0.0.1:8082",
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
  use: {
    baseURL: "http://127.0.0.1:5173",
    channel: "msedge",
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "passenger-desktop",
      testMatch: "auth.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:8082",
        viewport: { width: 1440, height: 1050 },
      },
    },
    {
      name: "desktop",
      testMatch: "admin.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1050 },
      },
    },
    {
      name: "mobile",
      testMatch: "admin.spec.ts",
      use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" },
    },
    {
      name: "passenger-preview",
      testMatch: "mobile.spec.ts",
      use: {
        ...devices["Pixel 7"],
        baseURL: "http://127.0.0.1:8082",
        defaultBrowserType: "chromium",
      },
    },
  ],
});
