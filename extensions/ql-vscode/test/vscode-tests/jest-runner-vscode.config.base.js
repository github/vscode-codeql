const path = require("path");
const os = require("os");
const tmp = require("tmp-promise");

const overrideTmpDir = process.env.RUNNER_TEMP || os.tmpdir();
console.log(`TmpDir: ${overrideTmpDir}`);
const tmpDir = tmp.dirSync({ unsafeCleanup: true, tmpdir: overrideTmpDir });

const rootDir = path.resolve(__dirname, "../..");

/** @type import("jest-runner-vscode").RunnerOptions */
const config = {
  // Temporary until https://github.com/github/vscode-codeql/issues/2402 is fixed
  // version: "stable",
  version: "1.77.3",
  launchArgs: [
    "--disable-gpu",
    "--extensions-dir=" + path.join(rootDir, ".vscode-test", "extensions"),
  ],
  extensionDevelopmentPath: rootDir,
  // Hide VSCode stdout, but show console.log
  filterOutput: true,
  // Hide information about VSCode exit code and download
  quiet: true,
};

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  if (process.env.VSCODE_WAIT_FOR_DEBUGGER === "true") {
    config.launchArgs?.push("--inspect-brk-extensions", "9223");
  } else {
    config.launchArgs?.push("--inspect-extensions", "9223");
  }
}

module.exports = {
  config,
  tmpDir,
  rootDir,
};
