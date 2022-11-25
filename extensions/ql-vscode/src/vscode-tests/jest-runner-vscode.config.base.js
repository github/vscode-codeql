const path = require("path");
const tmp = require("tmp-promise");

const tmpDir = tmp.dirSync({ unsafeCleanup: true });

const rootDir = path.resolve(__dirname, "../..");

/** @type import("jest-runner-vscode").RunnerOptions */
const config = {
  version: "stable",
  launchArgs: [
    "--disable-gpu",
    "--extensions-dir=" + path.join(rootDir, ".vscode-test", "extensions"),
    "--user-data-dir=" + path.join(tmpDir.name, "user-data"),
  ],
  extensionDevelopmentPath: rootDir,
};

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  config.launchArgs?.push("--inspect-extensions", "9223");
}

module.exports = {
  config,
  tmpDir,
  rootDir,
};
