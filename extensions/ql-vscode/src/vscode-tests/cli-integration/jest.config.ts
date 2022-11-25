import type { Config } from "jest";

import baseConfig from "../jest.config.base";

const config: Config = {
  ...baseConfig,
  runner: "<rootDir>/jest-runner-cli-integration.ts",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};

export default config;
