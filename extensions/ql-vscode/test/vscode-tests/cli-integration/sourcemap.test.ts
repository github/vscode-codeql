import { Selection, window, workspace } from "vscode";
import { join, basename } from "path";
import { tmpDir } from "../../../src/tmp-dir";
import { readFile, writeFile, ensureDir, copy } from "fs-extra";
import { createVSCodeCommandManager } from "../../../src/common/vscode/commands";
import type { AllCommands } from "../../../src/common/commands";

/**
 * Integration tests for queries
 */
describe("SourceMap", () => {
  const commandManager = createVSCodeCommandManager<AllCommands>();

  it("should jump to QL code", async () => {
    const root = workspace.workspaceFolders![0].uri.fsPath;
    const srcFiles = {
      summary: join(root, "log-summary", "evaluator-log.summary"),
      summaryMap: join(root, "log-summary", "evaluator-log.summary.map"),
    };
    // We need to modify the source map so that its paths point to the actual location of the
    // workspace root on this machine. We'll copy the summary and its source map to a temp
    // directory, modify the source map their, and open that summary.
    const tempFiles = await copyFilesToTempDirectory(srcFiles);

    // The checked-in sourcemap has placeholders of the form `${root}`, which we need to replace
    // with the actual root directory.
    const mapText = await readFile(tempFiles.summaryMap, "utf-8");
    // Always use forward slashes, since they work everywhere.
    const slashRoot = root.replaceAll("\\", "/");
    const newMapText = mapText.replaceAll("${root}", slashRoot);
    await writeFile(tempFiles.summaryMap, newMapText);

    const summaryDocument = await workspace.openTextDocument(tempFiles.summary);
    expect(summaryDocument.languageId).toBe("ql-summary");
    const summaryEditor = await window.showTextDocument(summaryDocument);
    summaryEditor.selection = new Selection(356, 10, 356, 10);
    await commandManager.execute("codeQL.gotoQL");

    const newEditor = window.activeTextEditor;
    expect(newEditor).toBeDefined();
    const newDocument = newEditor!.document;
    expect(basename(newDocument.fileName)).toBe("Namespace.qll");
    const newSelection = newEditor!.selection;
    expect(newSelection.start.line).toBe(60);
    expect(newSelection.start.character).toBe(2);
  });

  async function copyFilesToTempDirectory<T extends Record<string, string>>(
    files: T,
  ): Promise<T> {
    const tempDir = join(tmpDir.name, "log-summary");
    await ensureDir(tempDir);
    const result: Record<string, string> = {};
    for (const [key, srcPath] of Object.entries(files)) {
      const destPath = join(tempDir, basename(srcPath));
      await copy(srcPath, destPath);
      result[key] = destPath;
    }

    return result as T;
  }
});
