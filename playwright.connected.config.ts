import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/connected",
  fullyParallel: false,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    env: {
      VITE_OIDC_AUTHORITY: "https://identity.test",
      VITE_OIDC_CLIENT_ID: "vapt-test",
    },
  },
  reporter: [["list"]],
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
