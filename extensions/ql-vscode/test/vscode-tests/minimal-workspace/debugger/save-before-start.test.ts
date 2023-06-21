import * as path from "path";
import {
  Position,
  TextDocument,
  ViewColumn,
  commands,
  window,
  workspace,
} from "vscode";
import { saveAllInGroup } from "../../../../src/run-queries-shared";

/**
 * Returns a new `TextDocument` with the given file name.
 *
 * @param file Path to the file to open, or undefined to create an untitled document.
 * @param isDirty True if the document should have an edit applied.
 * @param viewColumn The `ViewColumn` in which to open the file's editor.
 * @returns The new `TextDocument`
 */
async function mockDocument(
  file: string | undefined,
  isDirty: boolean,
  viewColumn: ViewColumn,
): Promise<TextDocument> {
  let doc: TextDocument;
  if (file !== undefined) {
    doc = await workspace.openTextDocument(
      path.join(workspace.workspaceFolders![0].uri.fsPath, file),
    );
    const editor = await window.showTextDocument(doc, viewColumn, true);
    if (isDirty) {
      await editor.edit((edit) => {
        edit.insert(new Position(0, 0), "test");
      });
    }
  } else {
    doc = await workspace.openTextDocument({
      content: 'select "untitled"',
      language: "ql",
    });
    await window.showTextDocument(doc, viewColumn, true);
  }

  return doc;
}

/**
 * Returns a promise that resolves after the given number of milliseconds, and returns the string
 * "timeout".
 */
function delay(ms: number): Promise<string> {
  return new Promise((resolve) => setTimeout(() => resolve("timeout"), ms));
}

jest.setTimeout(10000); // A little extra time for the save dialog to appear.

const dirtyFile = "debugger/dirty.ql";
const cleanFile = "debugger/clean.ql";
const otherGroupDirtyFile = "debugger/other-dirty.ql";
const otherGroupCleanFile = "debugger/other-clean.ql";

describe("saveBeforeStart", () => {
  // We can't easily mock `TextDocument` because its properties are read-only and/or not
  // configurable, so we rely on the actual `save()` method and the actual `isDirty` property.

  beforeEach(async () => {
    await commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("should not save untitled documents without `includeUntitled`", async () => {
    const dirtyDoc = await mockDocument(dirtyFile, true, ViewColumn.One);
    const cleanDoc = await mockDocument(cleanFile, false, ViewColumn.One);

    await saveAllInGroup(false);

    expect(dirtyDoc.isDirty).toBe(false);
    expect(cleanDoc.isDirty).toBe(false);
  });

  it("should not save dirty documents in other tab groups", async () => {
    const dirtyDoc = await mockDocument(dirtyFile, true, ViewColumn.One);
    const cleanDoc = await mockDocument(cleanFile, false, ViewColumn.One);
    const otherGroupDirtyDoc = await mockDocument(
      otherGroupDirtyFile,
      true,
      ViewColumn.Two,
    );
    const otherGroupCleanDoc = await mockDocument(
      otherGroupCleanFile,
      false,
      ViewColumn.Two,
    );

    await saveAllInGroup(false);

    expect(dirtyDoc.isDirty).toBe(false);
    expect(cleanDoc.isDirty).toBe(false);
    expect(otherGroupDirtyDoc.isDirty).toBe(true);
    expect(otherGroupCleanDoc.isDirty).toBe(false);
  });

  it("should save untitled documents with `includeUntitled`", async () => {
    const dirtyDoc = await mockDocument(dirtyFile, true, ViewColumn.One);
    const cleanDoc = await mockDocument(cleanFile, false, ViewColumn.One);
    const untitledDoc = await mockDocument(undefined, true, ViewColumn.One);
    const otherGroupDirtyDoc = await mockDocument(
      otherGroupDirtyFile,
      true,
      ViewColumn.Two,
    );
    const otherGroupCleanDoc = await mockDocument(
      otherGroupCleanFile,
      false,
      ViewColumn.Two,
    );

    // Calling `save()` on an untitled document will bring up the file save dialog, and there's no
    // good way to spy on `save()` because it's defined as read-only. Instead, we'll do the save all
    // operation _anyway_, and _expect_ it to time out after 4 seconds. If it doesn't time out, then
    // we know that the save dialog never popped up.
    // This is pretty horrible, but it's the best I can come up with. It does need to be the last
    // test in the suite, because it leaves the save dialog open.
    const saveAll = async () => {
      await saveAllInGroup(true);
      return "saved";
    };

    const result = await Promise.race([saveAll(), delay(4000)]);

    expect(result).toBe("timeout");
    expect(dirtyDoc.isDirty).toBe(false);
    expect(cleanDoc.isDirty).toBe(false);
    expect(untitledDoc.isDirty).toBe(true);
    expect(otherGroupDirtyDoc.isDirty).toBe(true);
    expect(otherGroupCleanDoc.isDirty).toBe(false);
  });
});
