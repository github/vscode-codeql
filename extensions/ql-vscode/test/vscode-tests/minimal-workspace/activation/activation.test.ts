// This file needs to be located in a separate directory from all other tests. The jest-runner-vscode will
// create a new VSCode instance for every directory containing tests, so this will ensure that this
// test is run at the start-up of a new VSCode instance. No other files should be located in this directory since
// those may activate the extension before this test is run.

import { extensions } from "vscode";

// Note that this may open the most recent VSCode workspace.
describe("launching with no specified workspace", () => {
  const ext = extensions.getExtension("GitHub.vscode-codeql");
  it("should install the extension", () => {
    expect(ext).not.toBeUndefined();
  });
  it("should not activate the extension at first", () => {
    expect(ext!.isActive).toBeFalsy();
  });
});
