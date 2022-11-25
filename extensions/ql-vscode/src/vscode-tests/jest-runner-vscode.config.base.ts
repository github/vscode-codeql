import * as path from "path";
import * as tmp from "tmp-promise";
import { RunnerOptions } from "jest-runner-vscode";

export const tmpDir = tmp.dirSync({ unsafeCleanup: true });

export const rootDir = path.resolve(__dirname, "../..");

const config: RunnerOptions = {
  version: "stable",
  launchArgs: [
    "--disable-gpu",
    "--extensions-dir=" + path.join(rootDir, ".vscode-test", "extensions"),
    "--user-data-dir=" + path.join(tmpDir.name, "user-data"),
  ],
  extensionDevelopmentPath: rootDir,
};

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  if (process.env.VSCODE_WAIT_FOR_DEBUGGER === "true") {
    config.launchArgs?.push("--inspect-brk-extensions", "9223");
  } else {
    config.launchArgs?.push("--inspect-extensions", "9223");
  }
}

export default config;
