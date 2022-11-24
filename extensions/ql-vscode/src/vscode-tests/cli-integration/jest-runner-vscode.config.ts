import * as path from "path";

import { RunnerOptions } from "jest-runner-vscode";

import baseConfig, { rootDir } from "../jest-runner-vscode.config.base";

const config: RunnerOptions = {
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
    // CLI integration tests requires a multi-root workspace so that the data and the QL sources are accessible.
    ...(process.env.TEST_CODEQL_PATH ? [process.env.TEST_CODEQL_PATH] : []),
  ],
  extensionTestsEnv: {
    ...baseConfig.extensionTestsEnv,
    INTEGRATION_TEST_MODE: "true",
  },
};

// We are purposefully not using export default here since that would result in an ESModule, which doesn't seem to be
// supported properly by jest-runner-vscode (cosmiconfig doesn't really seem to support it).
module.exports = config;
