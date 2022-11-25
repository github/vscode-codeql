const { config: baseConfig } = require("../jest-runner-vscode.config.base");

/** @type import("jest-runner-vscode").RunnerOptions */
const config = {
  ...baseConfig,
  launchArgs: [...(baseConfig.launchArgs ?? []), "--disable-extensions"],
};

module.exports = config;
