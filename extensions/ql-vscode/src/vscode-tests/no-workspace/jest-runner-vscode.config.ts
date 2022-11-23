import * as path from "path";
import * as tmp from "tmp-promise";
import { RunnerOptions } from "jest-runner-vscode";

const tmpDir = tmp.dirSync({ unsafeCleanup: true });

const config: RunnerOptions = {
  version: "stable",
  launchArgs: [
    "--disable-extensions",
    "--disable-gpu",
    "--new-window",
    "--user-data-dir=" + path.join(tmpDir.name, "user-data"),
  ],
  workspaceDir: path.resolve(__dirname, "test/data"),
  openInFolder: true,
  extensionDevelopmentPath: path.resolve(__dirname),
};

// We are purposefully not using export default here since that would result in an ESModule, which doesn't seem to be
// supported properly by jest-runner-vscode (cosmiconfig doesn't really seem to support it).
module.exports = config;
