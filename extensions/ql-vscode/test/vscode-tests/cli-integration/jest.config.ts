import type { Config } from "jest";

import baseConfig from "../jest.config.base";

const config: Config = {
  ...baseConfig,
  runner: "<rootDir>/../jest-runner-installed-extensions.ts",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // CLI integration tests call into the CLI and execute queries, so these are expected to take a lot longer
  // than the default 5 seconds.
  testTimeout: 300_000, // 3 minutes
};

export default config;
