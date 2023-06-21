import { dirname, extname } from "path";
import * as vscode from "vscode";
import {
  TestAdapter,
  TestLoadStartedEvent,
  TestLoadFinishedEvent,
  TestRunStartedEvent,
  TestRunFinishedEvent,
  TestSuiteEvent,
  TestEvent,
  TestSuiteInfo,
  TestInfo,
  TestHub,
} from "vscode-test-adapter-api";
import { TestAdapterRegistrar } from "vscode-test-adapter-util";
import { QLTestDiscovery } from "./qltest-discovery";
import { Event, EventEmitter, CancellationTokenSource } from "vscode";
import { DisposableObject } from "../pure/disposable-object";
import { CodeQLCliServer, TestCompleted } from "../codeql-cli/cli";
import { testLogger } from "../common/logging/vscode";
import { TestRunner } from "./test-runner";
import {
  FileTreeDirectory,
  FileTreeLeaf,
  FileTreeNode,
} from "../common/file-tree-nodes";

/**
 * Get the full path of the `.expected` file for the specified QL test.
 * @param testPath The full path to the test file.
 */
export function getExpectedFile(testPath: string): string {
  return getTestOutputFile(testPath, ".expected");
}

/**
 * Get the full path of the `.actual` file for the specified QL test.
 * @param testPath The full path to the test file.
 */
export function getActualFile(testPath: string): string {
  return getTestOutputFile(testPath, ".actual");
}

/**
 * Get the directory containing the specified QL test.
 * @param testPath The full path to the test file.
 */
export function getTestDirectory(testPath: string): string {
  return dirname(testPath);
}

/**
 * Gets the the full path to a particular output file of the specified QL test.
 * @param testPath The full path to the QL test.
 * @param extension The file extension of the output file.
 */
function getTestOutputFile(testPath: string, extension: string): string {
  return changeExtension(testPath, extension);
}

/**
 * A factory service that creates `QLTestAdapter` objects for workspace folders on demand.
 */
export class QLTestAdapterFactory extends DisposableObject {
  constructor(
    testHub: TestHub,
    testRunner: TestRunner,
    cliServer: CodeQLCliServer,
  ) {
    super();

    // this will register a QLTestAdapter for each WorkspaceFolder
    this.push(
      new TestAdapterRegistrar(
        testHub,
        (workspaceFolder) =>
          new QLTestAdapter(workspaceFolder, testRunner, cliServer),
      ),
    );
  }
}

/**
 * Change the file extension of the specified path.
 * @param p The original file path.
 * @param ext The new extension, including the `.`.
 */
function changeExtension(p: string, ext: string): string {
  return p.slice(0, -extname(p).length) + ext;
}

/**
 * Test adapter for QL tests.
 */
export class QLTestAdapter extends DisposableObject implements TestAdapter {
  private readonly qlTestDiscovery: QLTestDiscovery;
  private readonly _tests = this.push(
    new EventEmitter<TestLoadStartedEvent | TestLoadFinishedEvent>(),
  );
  private readonly _testStates = this.push(
    new EventEmitter<
      TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent
    >(),
  );
  private readonly _autorun = this.push(new EventEmitter<void>());
  private runningTask?: vscode.CancellationTokenSource = undefined;

  constructor(
    public readonly workspaceFolder: vscode.WorkspaceFolder,
    private readonly testRunner: TestRunner,
    cliServer: CodeQLCliServer,
  ) {
    super();

    this.qlTestDiscovery = this.push(
      new QLTestDiscovery(workspaceFolder, cliServer),
    );
    void this.qlTestDiscovery.refresh();

    this.push(this.qlTestDiscovery.onDidChangeTests(this.discoverTests, this));
  }

  public get tests(): Event<TestLoadStartedEvent | TestLoadFinishedEvent> {
    return this._tests.event;
  }

  public get testStates(): Event<
    TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent
  > {
    return this._testStates.event;
  }

  public get autorun(): Event<void> | undefined {
    return this._autorun.event;
  }

  private static createTestOrSuiteInfos(
    testNodes: readonly FileTreeNode[],
  ): Array<TestSuiteInfo | TestInfo> {
    return testNodes.map((childNode) => {
      return QLTestAdapter.createTestOrSuiteInfo(childNode);
    });
  }

  private static createTestOrSuiteInfo(
    testNode: FileTreeNode,
  ): TestSuiteInfo | TestInfo {
    if (testNode instanceof FileTreeLeaf) {
      return QLTestAdapter.createTestInfo(testNode);
    } else if (testNode instanceof FileTreeDirectory) {
      return QLTestAdapter.createTestSuiteInfo(testNode, testNode.name);
    } else {
      throw new Error("Unexpected test type.");
    }
  }

  private static createTestInfo(testFile: FileTreeLeaf): TestInfo {
    return {
      type: "test",
      id: testFile.path,
      label: testFile.name,
      tooltip: testFile.path,
      file: testFile.path,
    };
  }

  private static createTestSuiteInfo(
    testDirectory: FileTreeDirectory,
    label: string,
  ): TestSuiteInfo {
    return {
      type: "suite",
      id: testDirectory.path,
      label,
      children: QLTestAdapter.createTestOrSuiteInfos(testDirectory.children),
      tooltip: testDirectory.path,
    };
  }

  public async load(): Promise<void> {
    this.discoverTests();
  }

  private discoverTests(): void {
    this._tests.fire({ type: "started" } as TestLoadStartedEvent);

    const testDirectory = this.qlTestDiscovery.testDirectory;
    let testSuite: TestSuiteInfo | undefined;
    if (testDirectory?.children.length) {
      const children = QLTestAdapter.createTestOrSuiteInfos(
        testDirectory.children,
      );
      testSuite = {
        type: "suite",
        label: "CodeQL",
        id: testDirectory.path,
        children,
      };
    }
    this._tests.fire({
      type: "finished",
      suite: testSuite,
    } as TestLoadFinishedEvent);
  }

  public async run(tests: string[]): Promise<void> {
    if (this.runningTask !== undefined) {
      throw new Error("Tests already running.");
    }

    testLogger.outputChannel.clear();
    testLogger.outputChannel.show(true);

    this.runningTask = this.track(new CancellationTokenSource());
    const token = this.runningTask.token;

    this._testStates.fire({
      type: "started",
      tests,
    } as TestRunStartedEvent);

    await this.testRunner.run(tests, testLogger, token, (event) =>
      this.processTestEvent(event),
    );

    this._testStates.fire({ type: "finished" } as TestRunFinishedEvent);
    this.clearTask();
  }

  private clearTask(): void {
    if (this.runningTask !== undefined) {
      const runningTask = this.runningTask;
      this.runningTask = undefined;
      this.disposeAndStopTracking(runningTask);
    }
  }

  public cancel(): void {
    if (this.runningTask !== undefined) {
      void testLogger.log("Cancelling test run...");
      this.runningTask.cancel();
      this.clearTask();
    }
  }

  private async processTestEvent(event: TestCompleted): Promise<void> {
    const state = event.pass
      ? "passed"
      : event.messages?.length
      ? "errored"
      : "failed";
    let message: string | undefined;
    if (event.failureDescription || event.diff?.length) {
      message =
        event.failureStage === "RESULT"
          ? [
              "",
              `${state}: ${event.test}`,
              event.failureDescription || event.diff?.join("\n"),
              "",
            ].join("\n")
          : [
              "",
              `${event.failureStage?.toLowerCase() ?? "unknown stage"} error: ${
                event.test
              }`,
              event.failureDescription ||
                `${event.messages[0].severity}: ${event.messages[0].message}`,
              "",
            ].join("\n");
      void testLogger.log(message);
    }
    this._testStates.fire({
      type: "test",
      state,
      test: event.test,
      message,
      decorations: event.messages?.map((msg) => ({
        line: msg.position.line,
        message: msg.message,
      })),
    });
  }
}
