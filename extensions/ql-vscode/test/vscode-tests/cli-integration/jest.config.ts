import type { Config } from "jest";

import baseConfig from "../jest.config.base";

const config: Config = {
  ...baseConfig,
  runner: "<rootDir>/../jest-runner-vscode-codeql-cli.ts",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // CLI integration tests call into the CLI and execute queries, so these are expected to take a lot longer
  // than the default 5 seconds.
  testTimeout: 180_000, // 3 minutes
  // Ensure that Jest exits even when there are some remaining handles open
  forceExit: true,
};

export default config;
