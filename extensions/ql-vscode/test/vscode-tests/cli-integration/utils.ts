import { workspace } from "vscode";
import { join } from "path";

/**
 * Get the absolute path to a file in the temporary copy of the `data` folder.
 */
export function getDataFolderFilePath(path: string): string {
  return join(workspace.workspaceFolders![0].uri.fsPath, path);
}
