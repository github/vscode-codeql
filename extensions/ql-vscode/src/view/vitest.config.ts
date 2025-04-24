import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    browser: {
      enabled: true,
      provider: "playwright",
      instances: [{ browser: "chromium" }],
    },
    setupFiles: "./vitest.setup.ts",
  },
});
