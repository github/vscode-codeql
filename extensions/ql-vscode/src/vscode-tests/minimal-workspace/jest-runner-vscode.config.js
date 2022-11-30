const path = require("path");

const {
  config: baseConfig,
  rootDir,
} = require("../jest-runner-vscode.config.base");

/** @type import("jest-runner-vscode").RunnerOptions */
const config = {
  ...baseConfig,
  launchArgs: [
    ...(baseConfig.launchArgs ?? []),
    "--disable-extensions",
    path.resolve(rootDir, "test/data"),
  ],
  retries: 1,
};

module.exports = config;
