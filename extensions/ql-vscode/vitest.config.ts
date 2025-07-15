import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const setupFiles = [resolve(__dirname, "./vitest.setup.ts")];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit-tests",
          root: "./test/unit-tests",
          globals: true,
          setupFiles,
        },
      },
      {
        test: {
          name: "view-tests",
          root: "./src/view",
          globals: true,
          setupFiles: [
            ...setupFiles,
            resolve(__dirname, "src/view/vitest.setup.ts"),
          ],
          browser: {
            provider: "playwright",
            enabled: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
