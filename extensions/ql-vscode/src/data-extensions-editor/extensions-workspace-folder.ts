import { window, WorkspaceFolder } from "vscode";
import { getOnDiskWorkspaceFoldersObjects } from "../common/vscode/workspace-folders";

export async function autoPickWorkspaceFolder(
  language: string,
): Promise<WorkspaceFolder | undefined> {
  const workspaceFolders = getOnDiskWorkspaceFoldersObjects();

  // If there's only 1 workspace folder, use that
  if (workspaceFolders.length === 1) {
    return workspaceFolders[0];
  }

  // In the vscode-codeql-starter repository, all workspace folders are named "codeql-custom-queries-<language>",
  // so we can use that to find the workspace folder for the language
  const starterWorkspaceFolderForLanguage = workspaceFolders.find(
    (folder) => folder.name === `codeql-custom-queries-${language}`,
  );
  if (starterWorkspaceFolderForLanguage) {
    return starterWorkspaceFolderForLanguage;
  }

  // Otherwise, try to find one that ends with "-<language>"
  const workspaceFolderForLanguage = workspaceFolders.find((folder) =>
    folder.name.endsWith(`-${language}`),
  );
  if (workspaceFolderForLanguage) {
    return workspaceFolderForLanguage;
  }

  // If we can't find one, just ask the user
  return askForWorkspaceFolder();
}

export async function askForWorkspaceFolder(): Promise<
  WorkspaceFolder | undefined
> {
  const workspaceFolders = getOnDiskWorkspaceFoldersObjects();
  const workspaceFolderOptions = workspaceFolders.map((folder) => ({
    label: folder.name,
    detail: folder.uri.fsPath,
    folder,
  }));

  // We're not using window.showWorkspaceFolderPick because that also includes the database source folders while
  // we only want to include on-disk workspace folders.
  const workspaceFolder = await window.showQuickPick(workspaceFolderOptions, {
    title: "Select workspace folder to create extension pack in",
  });
  if (!workspaceFolder) {
    return undefined;
  }

  return workspaceFolder.folder;
}
