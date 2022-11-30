import * as fs from "fs-extra";
import * as path from "path";
import { Uri, TextDocumentShowOptions, commands, window } from "vscode";
import {
  TestHub,
  TestController,
  TestAdapter,
  TestRunStartedEvent,
  TestRunFinishedEvent,
  TestEvent,
  TestSuiteEvent,
} from "vscode-test-adapter-api";

import { showAndLogWarningMessage } from "./helpers";
import { TestTreeNode } from "./test-tree-node";
import { DisposableObject } from "./pure/disposable-object";
import { UIService } from "./vscode-utils/ui-service";
import { QLTestAdapter, getExpectedFile, getActualFile } from "./test-adapter";
import { extLogger } from "./common";

type VSCodeTestEvent =
  | TestRunStartedEvent
  | TestRunFinishedEvent
  | TestSuiteEvent
  | TestEvent;

/**
 * Test event listener. Currently unused, but left in to keep the plumbing hooked up for future use.
 */
class QLTestListener extends DisposableObject {
  constructor(adapter: TestAdapter) {
    super();

    this.push(adapter.testStates(this.onTestStatesEvent, this));
  }

  private onTestStatesEvent(_e: VSCodeTestEvent): void {
    /**/
  }
}

/**
 * Service that implements all UI and commands for QL tests.
 */
export class TestUIService extends UIService implements TestController {
  private readonly listeners: Map<TestAdapter, QLTestListener> = new Map();

  constructor(private readonly testHub: TestHub) {
    super();

    void extLogger.log("Registering CodeQL test panel commands.");
    this.registerCommand(
      "codeQLTests.showOutputDifferences",
      this.showOutputDifferences,
    );
    this.registerCommand("codeQLTests.acceptOutput", this.acceptOutput);

    testHub.registerTestController(this);
  }

  public dispose(): void {
    this.testHub.unregisterTestController(this);

    super.dispose();
  }

  public registerTestAdapter(adapter: TestAdapter): void {
    this.listeners.set(adapter, new QLTestListener(adapter));
  }

  public unregisterTestAdapter(adapter: TestAdapter): void {
    if (adapter instanceof QLTestAdapter) {
      this.listeners.delete(adapter);
    }
  }

  private async acceptOutput(node: TestTreeNode): Promise<void> {
    const testId = node.info.id;
    const stat = await fs.lstat(testId);
    if (stat.isFile()) {
      const expectedPath = getExpectedFile(testId);
      const actualPath = getActualFile(testId);
      await fs.copy(actualPath, expectedPath, { overwrite: true });
    }
  }

  private async showOutputDifferences(node: TestTreeNode): Promise<void> {
    const testId = node.info.id;
    const stat = await fs.lstat(testId);
    if (stat.isFile()) {
      const expectedPath = getExpectedFile(testId);
      const expectedUri = Uri.file(expectedPath);
      const actualPath = getActualFile(testId);
      const options: TextDocumentShowOptions = {
        preserveFocus: true,
        preview: true,
      };

      if (!(await fs.pathExists(expectedPath))) {
        void showAndLogWarningMessage(
          `'${path.basename(
            expectedPath,
          )}' does not exist. Creating an empty file.`,
        );
        await fs.createFile(expectedPath);
      }

      if (await fs.pathExists(actualPath)) {
        const actualUri = Uri.file(actualPath);
        await commands.executeCommand<void>(
          "vscode.diff",
          expectedUri,
          actualUri,
          `Expected vs. Actual for ${path.basename(testId)}`,
          options,
        );
      } else {
        await window.showTextDocument(expectedUri, options);
      }
    }
  }
}
