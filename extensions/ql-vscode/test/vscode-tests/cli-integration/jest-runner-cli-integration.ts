import { spawnSync } from "child_process";
import { dirname } from "path";

import type * as JestRunner from "jest-runner";
import VSCodeTestRunner, { RunnerOptions } from "jest-runner-vscode";
import { cosmiconfig } from "cosmiconfig";
import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
} from "@vscode/test-electron";
import { ensureCli } from "../ensureCli";

export default class JestRunnerCliIntegration extends VSCodeTestRunner {
  async runTests(
    tests: JestRunner.Test[],
    watcher: JestRunner.TestWatcher,
    onStart: JestRunner.OnTestStart,
    onResult: JestRunner.OnTestSuccess,
    onFailure: JestRunner.OnTestFailure,
  ): Promise<void> {
    // The CLI integration tests require certain extensions to be installed, which needs to happen before the tests are
    // actually run. The below code will resolve the path to the VSCode executable, and then use that to install the
    // required extensions.

    const installedOnVsCodeVersions =
      new Set<`${RunnerOptions["version"]}-${RunnerOptions["platform"]}`>();

    for (const test of tests) {
      const testDir = dirname(test.path);

      const options: RunnerOptions =
        ((await cosmiconfig("jest-runner-vscode").search(testDir))
          ?.config as RunnerOptions) ?? {};

      const { version, platform } = options;
      const versionKey = `${version}-${platform}`;

      if (installedOnVsCodeVersions.has(versionKey)) {
        continue;
      }

      const vscodeExecutablePath = await downloadAndUnzipVSCode(
        version,
        platform,
      );

      console.log(`Installing required extensions for ${vscodeExecutablePath}`);

      const [cli, ...args] =
        resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

      spawnSync(
        cli,
        [
          ...args,
          "--install-extension",
          "hbenl.vscode-test-explorer",
          "--install-extension",
          "ms-vscode.test-adapter-converter",
        ],
        {
          encoding: "utf-8",
          stdio: "inherit",
        },
      );

      installedOnVsCodeVersions.add(versionKey);
    }

    await ensureCli(true);

    return super.runTests(tests, watcher, onStart, onResult, onFailure);
  }
}
