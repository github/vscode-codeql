import * as path from "path";
import { RunnerOptions } from "jest-runner-vscode";

import baseConfig, { rootDir } from "../jest-runner-vscode.config.base";

const config: RunnerOptions = {
  ...baseConfig,
  launchArgs: [
    ...(baseConfig.launchArgs ?? []),
    "--disable-extensions",
    path.resolve(rootDir, "test/data"),
  ],
};

// We are purposefully not using export default here since that would result in an ESModule, which doesn't seem to be
// supported properly by jest-runner-vscode (cosmiconfig doesn't really seem to support it).
module.exports = config;
