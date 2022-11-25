import { fail } from "assert";
import { commands, Selection, window, workspace } from "vscode";
import * as path from "path";
import * as assert from "assert";
import { expect } from "chai";
import { tmpDir } from "../../helpers";
import * as fs from "fs-extra";

/**
 * Integration tests for queries
 */
describe("SourceMap", function () {
  this.timeout(20000);

  it("should jump to QL code", async () => {
    try {
      const root = workspace.workspaceFolders![0].uri.fsPath;
      const srcFiles = {
        summary: path.join(root, "log-summary", "evaluator-log.summary"),
        summaryMap: path.join(root, "log-summary", "evaluator-log.summary.map"),
      };
      // We need to modify the source map so that its paths point to the actual location of the
      // workspace root on this machine. We'll copy the summary and its source map to a temp
      // directory, modify the source map their, and open that summary.
      const tempFiles = await copyFilesToTempDirectory(srcFiles);

      // The checked-in sourcemap has placeholders of the form `${root}`, which we need to replace
      // with the actual root directory.
      const mapText = await fs.readFile(tempFiles.summaryMap, "utf-8");
      // Always use forward slashes, since they work everywhere.
      const slashRoot = root.replaceAll("\\", "/");
      const newMapText = mapText.replaceAll("${root}", slashRoot);
      await fs.writeFile(tempFiles.summaryMap, newMapText);

      const summaryDocument = await workspace.openTextDocument(
        tempFiles.summary,
      );
      assert(summaryDocument.languageId === "ql-summary");
      const summaryEditor = await window.showTextDocument(summaryDocument);
      summaryEditor.selection = new Selection(356, 10, 356, 10);
      await commands.executeCommand("codeQL.gotoQL");

      const newEditor = window.activeTextEditor;
      expect(newEditor).to.be.not.undefined;
      const newDocument = newEditor!.document;
      expect(path.basename(newDocument.fileName)).to.equal("Namespace.qll");
      const newSelection = newEditor!.selection;
      expect(newSelection.start.line).to.equal(60);
      expect(newSelection.start.character).to.equal(2);
    } catch (e) {
      console.error("Test Failed");
      fail(e as Error);
    }
  });

  async function copyFilesToTempDirectory<T extends Record<string, string>>(
    files: T,
  ): Promise<T> {
    const tempDir = path.join(tmpDir.name, "log-summary");
    await fs.ensureDir(tempDir);
    const result: Record<string, string> = {};
    for (const [key, srcPath] of Object.entries(files)) {
      const destPath = path.join(tempDir, path.basename(srcPath));
      await fs.copy(srcPath, destPath);
      result[key] = destPath;
    }

    return result as T;
  }
});
