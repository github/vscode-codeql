import type { Config } from "jest";

import baseConfig from "../jest.config.base";

const config: Config = {
  ...baseConfig,
  runner: "<rootDir>/../jest-runner-vscode-codeql-cli.ts",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};

export default config;
