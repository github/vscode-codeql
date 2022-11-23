import type { Config } from "jest";

import baseConfig from "../jest.config.base";

const config: Config = {
  ...baseConfig,
  runner: "<rootDir>/jest-runner-cli-integration.js",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
};

export default config;
