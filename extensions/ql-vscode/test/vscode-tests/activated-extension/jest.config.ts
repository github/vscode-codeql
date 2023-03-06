import type { Config } from "jest";

import baseConfig from "../jest.config.base";

const config: Config = {
  ...baseConfig,
  runner: "<rootDir>/../jest-runner-installed-extensions.ts",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};

export default config;
