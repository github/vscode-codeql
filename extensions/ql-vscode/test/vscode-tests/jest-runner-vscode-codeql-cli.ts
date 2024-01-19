import type * as JestRunner from "jest-runner";
import VSCodeTestRunner from "jest-runner-vscode";
import { ensureCli } from "./ensureCli";

export default class JestRunnerVscodeCodeqlCli extends VSCodeTestRunner {
  async runTests(
    tests: JestRunner.Test[],
    watcher: JestRunner.TestWatcher,
    onStart: JestRunner.OnTestStart,
    onResult: JestRunner.OnTestSuccess,
    onFailure: JestRunner.OnTestFailure,
  ): Promise<void> {
    // The CLI integration tests require the CLI to be available. We do not want to install the CLI
    // when VS Code is already running because this will not give any feedback to the test runner. Instead,
    // we'll download the CLI now and pass the path to the CLI to VS Code.
    await ensureCli(true);

    return super.runTests(tests, watcher, onStart, onResult, onFailure);
  }
}
