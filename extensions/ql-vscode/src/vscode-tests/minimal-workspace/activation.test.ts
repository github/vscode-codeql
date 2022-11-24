import * as path from "path";
import * as vscode from "vscode";
import * as determiningSelectedQueryTest from "./determining-selected-query-test";

// Temporary until Mocha is fully removed. This is necessary for passing timeouts to `it`.
declare let it: jest.It;

describe("launching with a minimal workspace", () => {
  const ext = vscode.extensions.getExtension("GitHub.vscode-codeql");
  it("should install the extension", () => {
    expect(ext).toBeDefined();
  });

  // Note, this test will only pass in pristine workspaces. This means that when run locally and you
  // reuse an existing workspace that starts with an open ql file, this test will fail. There is
  // no need to make any changes since this will still pass on CI.
  it("should not activate the extension at first", () => {
    expect(ext!.isActive).toEqual(false);
  });

  it("should activate the extension when a .ql file is opened", async () => {
    await delay();

    const folders = vscode.workspace.workspaceFolders;
    expect(folders?.length).toEqual(1);
    const folderPath = folders![0].uri.fsPath;
    const documentPath = path.resolve(folderPath, "query.ql");
    const document = await vscode.workspace.openTextDocument(documentPath);
    expect(document.languageId).toEqual("ql");
    // Delay slightly so that the extension has time to activate.
    await delay();
    expect(ext!.isActive).toBeTruthy();
  }, 60_000);

  async function delay() {
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
});

determiningSelectedQueryTest.run();
