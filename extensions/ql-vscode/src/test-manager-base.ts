import { copy, createFile, lstat, pathExists } from "fs-extra";
import { TestUICommands } from "./common/commands";
import { DisposableObject } from "./pure/disposable-object";
import { getActualFile, getExpectedFile } from "./test-adapter";
import { TestItem, TextDocumentShowOptions, Uri, window } from "vscode";
import { showAndLogWarningMessage } from "./helpers";
import { basename } from "path";
import { App } from "./common/app";
import { TestTreeNode } from "./test-tree-node";

export type TestNode = TestTreeNode | TestItem;

/**
 * Base class for both the legacy and new test services. Implements commands that are common to
 * both.
 */
export abstract class TestManagerBase extends DisposableObject {
  protected constructor(private readonly app: App) {
    super();
  }

  public getCommands(): TestUICommands {
    return {
      "codeQLTests.showOutputDifferences":
        this.showOutputDifferences.bind(this),
      "codeQLTests.acceptOutput": this.acceptOutput.bind(this),
    };
  }

  /** Override to compute the path of the test file from the selected node. */
  protected abstract getTestPath(node: TestNode): string;

  private async acceptOutput(node: TestNode): Promise<void> {
    const testPath = this.getTestPath(node);
    const stat = await lstat(testPath);
    if (stat.isFile()) {
      const expectedPath = getExpectedFile(testPath);
      const actualPath = getActualFile(testPath);
      await copy(actualPath, expectedPath, { overwrite: true });
    }
  }

  private async showOutputDifferences(node: TestNode): Promise<void> {
    const testId = this.getTestPath(node);
    const stat = await lstat(testId);
    if (stat.isFile()) {
      const expectedPath = getExpectedFile(testId);
      const expectedUri = Uri.file(expectedPath);
      const actualPath = getActualFile(testId);
      const options: TextDocumentShowOptions = {
        preserveFocus: true,
        preview: true,
      };

      if (!(await pathExists(expectedPath))) {
        void showAndLogWarningMessage(
          `'${basename(expectedPath)}' does not exist. Creating an empty file.`,
        );
        await createFile(expectedPath);
      }

      if (await pathExists(actualPath)) {
        const actualUri = Uri.file(actualPath);
        await this.app.commands.execute(
          "vscode.diff",
          expectedUri,
          actualUri,
          `Expected vs. Actual for ${basename(testId)}`,
          options,
        );
      } else {
        await window.showTextDocument(expectedUri, options);
      }
    }
  }
}
