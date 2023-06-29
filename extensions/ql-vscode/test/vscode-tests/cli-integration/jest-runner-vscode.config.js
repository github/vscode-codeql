const path = require("path");
const fs = require("fs");

const {
  config: baseConfig,
  tmpDir,
  rootDir,
} = require("../jest-runner-vscode.config.base");

const tmpDataDir = path.join(tmpDir.name, "data");
fs.cpSync(path.resolve(rootDir, "test/data"), tmpDataDir, {
  recursive: true,
});

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
    "--disable-workspace-trust", // Disable trust because we copy our workspace to a temp directory
    tmpDataDir,
    path.resolve(rootDir, "test/data-extensions"), // folder containing the extension packs and packs that are targeted by the extension pack
    // CLI integration tests requires a multi-root workspace so that the data and the QL sources are accessible.
    ...(process.env.TEST_CODEQL_PATH ? [process.env.TEST_CODEQL_PATH] : []),
  ],
  extensionTestsEnv: {
    ...baseConfig.extensionTestsEnv,
    INTEGRATION_TEST_MODE: "true",
  },
  retries: 3,
};

module.exports = config;
