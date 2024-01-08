import { dirname, join } from "path";
import type { WorkspaceFolder } from "vscode";
import { workspace } from "vscode";

/** Returns true if the specified workspace folder is on the file system. */
export function isWorkspaceFolderOnDisk(
  workspaceFolder: WorkspaceFolder,
): boolean {
  return workspaceFolder.uri.scheme === "file";
}

/** Gets all active workspace folders that are on the filesystem. */
export function getOnDiskWorkspaceFoldersObjects() {
  const workspaceFolders = workspace.workspaceFolders ?? [];
  return workspaceFolders.filter(isWorkspaceFolderOnDisk);
}

/** Gets all active workspace folders that are on the filesystem. */
export function getOnDiskWorkspaceFolders() {
  return getOnDiskWorkspaceFoldersObjects().map((folder) => folder.uri.fsPath);
}

/** Check if folder is already present in workspace */
export function isFolderAlreadyInWorkspace(folderName: string) {
  const workspaceFolders = workspace.workspaceFolders || [];

  return !!workspaceFolders.find(
    (workspaceFolder) => workspaceFolder.name === folderName,
  );
}

/**
 * Returns the path of the first folder in the workspace.
 * This is used to decide where to create skeleton QL packs.
 *
 * If the first folder is a QL pack, then the parent folder is returned.
 * This is because the vscode-codeql-starter repo contains a ql pack in
 * the first folder.
 *
 * This is a temporary workaround until we can retire the
 * vscode-codeql-starter repo.
 */
export function getFirstWorkspaceFolder() {
  const workspaceFolders = getOnDiskWorkspaceFolders();

  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error(
      "No workspace folders found. Please open a folder or workspace in VS Code.",
    );
  }

  const firstFolderFsPath = workspaceFolders[0];

  // For the vscode-codeql-starter repo, the first folder will be a ql pack
  // so we need to get the parent folder
  if (
    firstFolderFsPath.includes(
      join("vscode-codeql-starter", "codeql-custom-queries"),
    )
  ) {
    // return the parent folder
    return dirname(firstFolderFsPath);
  } else {
    // if the first folder is not a ql pack, then we are in a normal workspace
    return firstFolderFsPath;
  }
}
