import type { WorkspaceFolder } from "vscode";
import { workspace } from "vscode";
import { join } from "path";
import {
  getFirstWorkspaceFolder,
  isFolderAlreadyInWorkspace,
} from "../../../../../src/common/vscode/workspace-folders";

describe("isFolderAlreadyInWorkspace", () => {
  beforeEach(() => {
    const folders = [
      { name: "/first/path" },
      { name: "/second/path" },
    ] as WorkspaceFolder[];

    jest.spyOn(workspace, "workspaceFolders", "get").mockReturnValue(folders);
  });
  it("should return true if the folder is already in the workspace", () => {
    expect(isFolderAlreadyInWorkspace("/first/path")).toBe(true);
  });

  it("should return false if the folder is not in the workspace", () => {
    expect(isFolderAlreadyInWorkspace("/third/path")).toBe(false);
  });
});

describe("getFirstWorkspaceFolder", () => {
  it("should return the first workspace folder", async () => {
    jest.spyOn(workspace, "workspaceFolders", "get").mockReturnValue([
      {
        name: "codespaces-codeql",
        uri: { fsPath: "codespaces-codeql", scheme: "file" },
      },
    ] as WorkspaceFolder[]);

    expect(getFirstWorkspaceFolder()).toEqual("codespaces-codeql");
  });

  describe("if user is in vscode-codeql-starter workspace", () => {
    it("should set storage path to parent folder", async () => {
      jest.spyOn(workspace, "workspaceFolders", "get").mockReturnValue([
        {
          name: "codeql-custom-queries-cpp",
          uri: {
            fsPath: join("vscode-codeql-starter", "codeql-custom-queries-cpp"),
            scheme: "file",
          },
        },
        {
          name: "codeql-custom-queries-csharp",
          uri: {
            fsPath: join(
              "vscode-codeql-starter",
              "codeql-custom-queries-csharp",
            ),
            scheme: "file",
          },
        },
      ] as WorkspaceFolder[]);

      expect(getFirstWorkspaceFolder()).toEqual("vscode-codeql-starter");
    });
  });
});
