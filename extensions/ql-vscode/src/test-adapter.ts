import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
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
  TestHub
} from 'vscode-test-adapter-api';
import { TestAdapterRegistrar } from 'vscode-test-adapter-util';
import { QLTestFile, QLTestNode, QLTestDirectory, QLTestDiscovery } from './qltest-discovery';
import { Event, EventEmitter, CancellationTokenSource, CancellationToken } from 'vscode';
import { DisposableObject } from './pure/disposable-object';
import { CodeQLCliServer } from './cli';
import { getOnDiskWorkspaceFolders, showAndLogErrorMessage, showAndLogWarningMessage } from './helpers';
import { testLogger } from './logging';
import { DatabaseItem, DatabaseManager } from './databases';

/**
 * Get the full path of the `.expected` file for the specified QL test.
 * @param testPath The full path to the test file.
 */
export function getExpectedFile(testPath: string): string {
  return getTestOutputFile(testPath, '.expected');
}

/**
 * Get the full path of the `.actual` file for the specified QL test.
 * @param testPath The full path to the test file.
 */
export function getActualFile(testPath: string): string {
  return getTestOutputFile(testPath, '.actual');
}

/**
 * Get the directory containing the specified QL test.
 * @param testPath The full path to the test file.
 */
export function getTestDirectory(testPath: string): string {
  return path.dirname(testPath);
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
  constructor(testHub: TestHub, cliServer: CodeQLCliServer, databaseManager: DatabaseManager) {
    super();

    // this will register a QLTestAdapter for each WorkspaceFolder
    this.push(new TestAdapterRegistrar(
      testHub,
      workspaceFolder => new QLTestAdapter(workspaceFolder, cliServer, databaseManager)
    ));
  }
}

/**
 * Change the file extension of the specified path.
 * @param p The original file path.
 * @param ext The new extension, including the `.`.
 */
function changeExtension(p: string, ext: string): string {
  return p.substr(0, p.length - path.extname(p).length) + ext;
}

/**
 * Test adapter for QL tests.
 */
export class QLTestAdapter extends DisposableObject implements TestAdapter {
  private readonly qlTestDiscovery: QLTestDiscovery;
  private readonly _tests = this.push(
    new EventEmitter<TestLoadStartedEvent | TestLoadFinishedEvent>());
  private readonly _testStates = this.push(
    new EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>());
  private readonly _autorun = this.push(new EventEmitter<void>());
  private runningTask?: vscode.CancellationTokenSource = undefined;

  constructor(
    public readonly workspaceFolder: vscode.WorkspaceFolder,
    private readonly cliServer: CodeQLCliServer,
    private readonly databaseManager: DatabaseManager
  ) {
    super();

    this.qlTestDiscovery = this.push(new QLTestDiscovery(workspaceFolder, cliServer));
    this.qlTestDiscovery.refresh();

    this.push(this.qlTestDiscovery.onDidChangeTests(this.discoverTests, this));
  }

  public get tests(): Event<TestLoadStartedEvent | TestLoadFinishedEvent> {
    return this._tests.event;
  }

  public get testStates(): Event<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent> {
    return this._testStates.event;
  }

  public get autorun(): Event<void> | undefined {
    return this._autorun.event;
  }

  private static createTestOrSuiteInfos(testNodes: readonly QLTestNode[]): (TestSuiteInfo | TestInfo)[] {
    return testNodes.map((childNode) => {
      return QLTestAdapter.createTestOrSuiteInfo(childNode);
    });
  }

  private static createTestOrSuiteInfo(testNode: QLTestNode): TestSuiteInfo | TestInfo {
    if (testNode instanceof QLTestFile) {
      return QLTestAdapter.createTestInfo(testNode);
    } else if (testNode instanceof QLTestDirectory) {
      return QLTestAdapter.createTestSuiteInfo(testNode, testNode.name);
    } else {
      throw new Error('Unexpected test type.');
    }
  }

  private static createTestInfo(testFile: QLTestFile): TestInfo {
    return {
      type: 'test',
      id: testFile.path,
      label: testFile.name,
      tooltip: testFile.path,
      file: testFile.path
    };
  }

  private static createTestSuiteInfo(testDirectory: QLTestDirectory, label: string): TestSuiteInfo {
    return {
      type: 'suite',
      id: testDirectory.path,
      label: label,
      children: QLTestAdapter.createTestOrSuiteInfos(testDirectory.children),
      tooltip: testDirectory.path
    };
  }

  public async load(): Promise<void> {
    this.discoverTests();
  }

  private discoverTests(): void {
    this._tests.fire({ type: 'started' } as TestLoadStartedEvent);

    const testDirectory = this.qlTestDiscovery.testDirectory;
    let testSuite: TestSuiteInfo | undefined;
    if (testDirectory?.children.length) {
      const children = QLTestAdapter.createTestOrSuiteInfos(testDirectory.children);
      testSuite = {
        type: 'suite',
        label: 'CodeQL',
        id: testDirectory.path,
        children
      };
    }
    this._tests.fire({
      type: 'finished',
      suite: testSuite
    } as TestLoadFinishedEvent);
  }

  public async run(tests: string[]): Promise<void> {
    if (this.runningTask !== undefined) {
      throw new Error('Tests already running.');
    }

    testLogger.outputChannel.clear();
    testLogger.outputChannel.show(true);

    this.runningTask = this.track(new CancellationTokenSource());
    const token = this.runningTask.token;

    this._testStates.fire({ type: 'started', tests: tests } as TestRunStartedEvent);

    const currentDatabaseUri = this.databaseManager.currentDatabaseItem?.databaseUri;
    const databasesUnderTest: DatabaseItem[] = [];
    for (const database of this.databaseManager.databaseItems) {
      for (const test of tests) {
        if (await database.isAffectedByTest(test)) {
          databasesUnderTest.push(database);
          break;
        }
      }
    }

    await this.removeDatabasesBeforeTests(databasesUnderTest, token);
    try {
      await this.runTests(tests, token);
    } catch (e) {
      // CodeQL testing can throw exception even in normal scenarios. For example, if the test run
      // produces no output (which is normal), the testing command would throw an exception on
      // unexpected EOF during json parsing. So nothing needs to be done here - all the relevant
      // error information (if any) should have already been written to the test logger.
    }
    await this.reopenDatabasesAfterTests(databasesUnderTest, currentDatabaseUri, token);

    this._testStates.fire({ type: 'finished' } as TestRunFinishedEvent);
    this.clearTask();
  }

  private async removeDatabasesBeforeTests(
    databasesUnderTest: DatabaseItem[], token: vscode.CancellationToken): Promise<void> {
    for (const database of databasesUnderTest) {
      try {
        await this.databaseManager
          .removeDatabaseItem(_ => { /* no progress reporting */ }, token, database);
      } catch (e) {
        // This method is invoked from Test Explorer UI, and testing indicates that Test
        // Explorer UI swallows any thrown exception without reporting it to the user.
        // So we need to display the error message ourselves and then rethrow.
        void showAndLogErrorMessage(`Cannot remove database ${database.name}: ${e}`);
        throw e;
      }
    }
  }

  private async reopenDatabasesAfterTests(
    databasesUnderTest: DatabaseItem[],
    currentDatabaseUri: vscode.Uri | undefined,
    token: vscode.CancellationToken): Promise<void> {
    for (const closedDatabase of databasesUnderTest) {
      const uri = closedDatabase.databaseUri;
      if (await this.isFileAccessible(uri)) {
        try {
          const reopenedDatabase = await this.databaseManager
            .openDatabase(_ => { /* no progress reporting */ }, token, uri);
          await this.databaseManager.renameDatabaseItem(reopenedDatabase, closedDatabase.name);
          if (currentDatabaseUri == uri) {
            await this.databaseManager.setCurrentDatabaseItem(reopenedDatabase, true);
          }
        } catch (e) {
          // This method is invoked from Test Explorer UI, and testing indicates that Test
          // Explorer UI swallows any thrown exception without reporting it to the user.
          // So we need to display the error message ourselves and then rethrow.
          void showAndLogWarningMessage(`Cannot reopen database ${uri}: ${e}`);
          throw e;
        }
      }
    }
  }

  private async isFileAccessible(uri: vscode.Uri): Promise<boolean> {
    try {
      await fs.access(uri.fsPath);
      return true;
    } catch {
      return false;
    }
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
      void testLogger.log('Cancelling test run...');
      this.runningTask.cancel();
      this.clearTask();
    }
  }

  private async runTests(tests: string[], cancellationToken: CancellationToken): Promise<void> {
    const workspacePaths = await getOnDiskWorkspaceFolders();
    for await (const event of await this.cliServer.runTests(tests, workspacePaths, {
      cancellationToken: cancellationToken,
      logger: testLogger
    })) {
      const state = event.pass
        ? 'passed'
        : event.messages?.length
          ? 'errored'
          : 'failed';
      let message: string | undefined;
      if (event.failureDescription || event.diff?.length) {
        message = ['', `${state}: ${event.test}`, event.failureDescription || event.diff?.join('\n'), ''].join('\n');
        void testLogger.log(message);
      }
      this._testStates.fire({
        type: 'test',
        state,
        test: event.test,
        message,
        decorations: event.messages?.map(msg => ({
          line: msg.position.line,
          message: msg.message
        }))
      });
    }
  }
}
