import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import * as determiningSelectedQueryTest from "./determining-selected-query-test";

describe("launching with a minimal workspace", async () => {
  const ext = vscode.extensions.getExtension("GitHub.vscode-codeql");
  it("should install the extension", () => {
    assert(ext);
  });

  // Note, this test will only pass in pristine workspaces. This means that when run locally and you
  // reuse an existing workspace that starts with an open ql file, this test will fail. There is
  // no need to make any changes since this will still pass on CI.
  it("should not activate the extension at first", () => {
    assert(ext!.isActive === false);
  });

  it("should activate the extension when a .ql file is opened", async function () {
    this.timeout(60000);
    await delay();

    const folders = vscode.workspace.workspaceFolders;
    assert(folders && folders.length === 1);
    const folderPath = folders![0].uri.fsPath;
    const documentPath = path.resolve(folderPath, "query.ql");
    const document = await vscode.workspace.openTextDocument(documentPath);
    assert(document.languageId === "ql");
    // Delay slightly so that the extension has time to activate.
    await delay();
    assert(ext!.isActive);
  });

  async function delay() {
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
});

determiningSelectedQueryTest.run();
