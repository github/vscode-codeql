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
    // explicitly disable extensions that are known to interfere with the CLI integration tests
    "--disable-extension",
    "eamodio.gitlens",
    "--disable-extension",
    "github.codespaces",
    "--disable-extension",
    "github.copilot",
    path.resolve(rootDir, "test/data"),
  ],
  extensionTestsEnv: {
    ...baseConfig.extensionTestsEnv,
    INTEGRATION_TEST_MODE: "true",
  },
  retries: 3,
};

module.exports = config;
