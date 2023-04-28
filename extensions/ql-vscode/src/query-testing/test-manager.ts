import { readFile } from "fs-extra";
import {
  CancellationToken,
  Location,
  Range,
  TestController,
  TestItem,
  TestMessage,
  TestRun,
  TestRunProfileKind,
  TestRunRequest,
  Uri,
  WorkspaceFolder,
  WorkspaceFoldersChangeEvent,
  tests,
  workspace,
} from "vscode";
import { DisposableObject } from "../pure/disposable-object";
import {
  QLTestDirectory,
  QLTestDiscovery,
  QLTestFile,
  QLTestNode,
} from "../qltest-discovery";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { getErrorMessage } from "../pure/helpers-pure";
import { BaseLogger, LogOptions } from "../common";
import { TestRunner } from "./test-runner";
import { TestManagerBase } from "./test-manager-base";
import { App } from "../common/app";
import { isWorkspaceFolderOnDisk } from "../helpers";

/**
 * Returns the complete text content of the specified file. If there is an error reading the file,
 * an error message is added to `testMessages` and this function returns undefined.
 */
async function tryReadFileContents(
  path: string,
  testMessages: TestMessage[],
): Promise<string | undefined> {
  try {
    return await readFile(path, { encoding: "utf-8" });
  } catch (e) {
    testMessages.push(
      new TestMessage(
        `Error reading from file '${path}': ${getErrorMessage(e)}`,
      ),
    );
    return undefined;
  }
}

function forEachTest(testItem: TestItem, op: (test: TestItem) => void): void {
  if (testItem.children.size > 0) {
    // This is a directory, so recurse into the children.
    for (const [, child] of testItem.children) {
      forEachTest(child, op);
    }
  } else {
    // This is a leaf node, so it's a test.
    op(testItem);
  }
}

/**
 * Implementation of `BaseLogger` that logs to the output of a `TestRun`.
 */
class TestRunLogger implements BaseLogger {
  public constructor(private readonly testRun: TestRun) {}

  public async log(message: string, options?: LogOptions): Promise<void> {
    // "\r\n" because that's what the test terminal wants.
    const lineEnding = options?.trailingNewline === false ? "" : "\r\n";
    this.testRun.appendOutput(message + lineEnding);
  }
}

/**
 * Handles test discovery for a specific workspace folder, and reports back to `TestManager`.
 */
class WorkspaceFolderHandler extends DisposableObject {
  private readonly testDiscovery: QLTestDiscovery;

  public constructor(
    private readonly workspaceFolder: WorkspaceFolder,
    private readonly testUI: TestManager,
    cliServer: CodeQLCliServer,
  ) {
    super();

    this.testDiscovery = new QLTestDiscovery(workspaceFolder, cliServer);
    this.push(
      this.testDiscovery.onDidChangeTests(this.handleDidChangeTests, this),
    );
    this.testDiscovery.refresh();
  }

  private handleDidChangeTests(): void {
    const testDirectory = this.testDiscovery.testDirectory;

    this.testUI.updateTestsForWorkspaceFolder(
      this.workspaceFolder,
      testDirectory,
    );
  }
}

/**
 * Service that populates the VS Code "Test Explorer" panel for CodeQL, and handles running and
 * debugging of tests.
 */
export class TestManager extends TestManagerBase {
  /**
   * Maps from each workspace folder being tracked to the `WorkspaceFolderHandler` responsible for
   * tracking it.
   */
  private readonly workspaceFolderHandlers = new Map<
    WorkspaceFolder,
    WorkspaceFolderHandler
  >();

  public constructor(
    app: App,
    private readonly testRunner: TestRunner,
    private readonly cliServer: CodeQLCliServer,
    // Having this as a parameter with a default value makes passing in a mock easier.
    private readonly testController: TestController = tests.createTestController(
      "codeql",
      "CodeQL Tests",
    ),
  ) {
    super(app);

    this.testController.createRunProfile(
      "Run",
      TestRunProfileKind.Run,
      this.run.bind(this),
    );

    // Start by tracking whatever folders are currently in the workspace.
    this.startTrackingWorkspaceFolders(workspace.workspaceFolders ?? []);

    // Listen for changes to the set of workspace folders.
    workspace.onDidChangeWorkspaceFolders(
      this.handleDidChangeWorkspaceFolders,
      this,
    );
  }

  public dispose(): void {
    this.workspaceFolderHandlers.clear(); // These will be disposed in the `super.dispose()` call.
    super.dispose();
  }

  protected getTestPath(node: TestItem): string {
    if (node.uri === undefined || node.uri.scheme !== "file") {
      throw new Error("Selected test is not a CodeQL test.");
    }
    return node.uri.fsPath;
  }

  /** Start tracking tests in the specified workspace folders. */
  private startTrackingWorkspaceFolders(
    workspaceFolders: readonly WorkspaceFolder[],
  ): void {
    // Only track on-disk workspace folders, to avoid trying to run the CLI test discovery command
    // on random URIs.
    workspaceFolders
      .filter(isWorkspaceFolderOnDisk)
      .forEach((workspaceFolder) => {
        const workspaceFolderHandler = new WorkspaceFolderHandler(
          workspaceFolder,
          this,
          this.cliServer,
        );
        this.track(workspaceFolderHandler);
        this.workspaceFolderHandlers.set(
          workspaceFolder,
          workspaceFolderHandler,
        );
      });
  }

  /** Stop tracking tests in the specified workspace folders. */
  private stopTrackingWorkspaceFolders(
    workspaceFolders: readonly WorkspaceFolder[],
  ): void {
    for (const workspaceFolder of workspaceFolders) {
      const workspaceFolderHandler =
        this.workspaceFolderHandlers.get(workspaceFolder);
      if (workspaceFolderHandler !== undefined) {
        // Delete the root item for this workspace folder, if any.
        this.testController.items.delete(workspaceFolder.uri.toString());
        this.disposeAndStopTracking(workspaceFolderHandler);
        this.workspaceFolderHandlers.delete(workspaceFolder);
      }
    }
  }

  private handleDidChangeWorkspaceFolders(
    e: WorkspaceFoldersChangeEvent,
  ): void {
    this.startTrackingWorkspaceFolders(e.added);
    this.stopTrackingWorkspaceFolders(e.removed);
  }

  /**
   * Update the test controller when we discover changes to the tests in the workspace folder.
   */
  public updateTestsForWorkspaceFolder(
    workspaceFolder: WorkspaceFolder,
    testDirectory: QLTestDirectory | undefined,
  ): void {
    if (testDirectory !== undefined) {
      // Adding an item with the same ID as an existing item will replace it, which is exactly what
      // we want.
      // Test discovery returns a root `QLTestDirectory` representing the workspace folder itself,
      // named after the `WorkspaceFolder` object's `name` property. We can map this directly to a
      // `TestItem`.
      this.testController.items.add(
        this.createTestItemTree(testDirectory, true),
      );
    } else {
      // No tests, so delete any existing item.
      this.testController.items.delete(workspaceFolder.uri.toString());
    }
  }

  /**
   * Creates a tree of `TestItem`s from the root `QlTestNode` provided by test discovery.
   */
  private createTestItemTree(node: QLTestNode, isRoot: boolean): TestItem {
    // Prefix the ID to identify it as a directory or a test
    const itemType = node instanceof QLTestDirectory ? "dir" : "test";
    const testItem = this.testController.createTestItem(
      // For the root of a workspace folder, use the full path as the ID. Otherwise, use the node's
      // name as the ID, since it's shorter but still unique.
      `${itemType} ${isRoot ? node.path : node.name}`,
      node.name,
      Uri.file(node.path),
    );

    for (const childNode of node.children) {
      const childItem = this.createTestItemTree(childNode, false);
      if (childNode instanceof QLTestFile) {
        childItem.range = new Range(0, 0, 0, 0);
      }
      testItem.children.add(childItem);
    }

    return testItem;
  }

  /**
   * Run the tests specified by the `TestRunRequest` parameter.
   *
   * Public because this is used in unit tests.
   */
  public async run(
    request: TestRunRequest,
    token: CancellationToken,
  ): Promise<void> {
    const testsToRun = this.computeTestsToRun(request);
    const testRun = this.testController.createTestRun(request, undefined, true);
    try {
      const tests: string[] = [];
      testsToRun.forEach((testItem, testPath) => {
        testRun.enqueued(testItem);
        tests.push(testPath);
      });

      const logger = new TestRunLogger(testRun);

      await this.testRunner.run(tests, logger, token, async (event) => {
        // Pass the test path from the event through `Uri` and back via `fsPath` so that it matches
        // the canonicalization of the URI that we used to create the `TestItem`.
        const testItem = testsToRun.get(Uri.file(event.test).fsPath);
        if (testItem === undefined) {
          throw new Error(
            `Unexpected result from unknown test '${event.test}'.`,
          );
        }

        const duration = event.compilationMs + event.evaluationMs;
        if (event.pass) {
          testRun.passed(testItem, duration);
        } else {
          // Construct a list of `TestMessage`s to report for the failure.
          const testMessages: TestMessage[] = [];
          if (event.failureDescription !== undefined) {
            testMessages.push(new TestMessage(event.failureDescription));
          }
          if (event.diff?.length && event.actual !== undefined) {
            // Actual results differ from expected results. Read both sets of results and create a
            // diff to put in the message.
            const expected = await tryReadFileContents(
              event.expected,
              testMessages,
            );
            const actual = await tryReadFileContents(
              event.actual,
              testMessages,
            );
            if (expected !== undefined && actual !== undefined) {
              testMessages.push(
                TestMessage.diff(
                  "Actual output differs from expected",
                  expected,
                  actual,
                ),
              );
            }
          }
          if (event.messages?.length > 0) {
            // The test didn't make it far enough to produce results. Transform any error messages
            // into `TestMessage`s and report the test as "errored".
            const testMessages = event.messages.map((m) => {
              const location = new Location(
                Uri.file(m.position.fileName),
                new Range(
                  m.position.line - 1,
                  m.position.column - 1,
                  m.position.endLine - 1,
                  m.position.endColumn - 1,
                ),
              );
              const testMessage = new TestMessage(m.message);
              testMessage.location = location;
              return testMessage;
            });
            testRun.errored(testItem, testMessages, duration);
          } else {
            // Results didn't match expectations. Report the test as "failed".
            if (testMessages.length === 0) {
              // If we managed to get here without creating any `TestMessage`s, create a default one
              // here. Any failed test needs at least one message.
              testMessages.push(new TestMessage("Test failed"));
            }
            testRun.failed(testItem, testMessages, duration);
          }
        }
      });
    } finally {
      testRun.end();
    }
  }

  /**
   * Computes the set of tests to run as specified in the `TestRunRequest` object.
   */
  private computeTestsToRun(request: TestRunRequest): Map<string, TestItem> {
    const testsToRun = new Map<string, TestItem>();
    if (request.include !== undefined) {
      // Include these tests, recursively expanding test directories into their list of contained
      // tests.
      for (const includedTestItem of request.include) {
        forEachTest(includedTestItem, (testItem) =>
          testsToRun.set(testItem.uri!.fsPath, testItem),
        );
      }
    } else {
      // Include all of the tests.
      for (const [, includedTestItem] of this.testController.items) {
        forEachTest(includedTestItem, (testItem) =>
          testsToRun.set(testItem.uri!.fsPath, testItem),
        );
      }
    }
    if (request.exclude !== undefined) {
      // Exclude the specified tests from the set we've computed so far, again recursively expanding
      // test directories into their list of contained tests.
      for (const excludedTestItem of request.exclude) {
        forEachTest(excludedTestItem, (testItem) =>
          testsToRun.delete(testItem.uri!.fsPath),
        );
      }
    }

    return testsToRun;
  }
}
