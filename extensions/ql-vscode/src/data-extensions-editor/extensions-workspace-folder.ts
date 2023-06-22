import { FileType, Uri, window, workspace, WorkspaceFolder } from "vscode";
import { getOnDiskWorkspaceFoldersObjects } from "../common/vscode/workspace-folders";
import { extLogger } from "../common/logging/vscode";
import { tmpdir } from "../common/files";

/**
 * Returns the ancestors of this path in order from furthest to closest (i.e. root of filesystem to parent directory)
 */
function getAncestors(uri: Uri): Uri[] {
  const ancestors: Uri[] = [];
  let current = uri;
  while (current.fsPath !== Uri.joinPath(current, "..").fsPath) {
    ancestors.push(current);
    current = Uri.joinPath(current, "..");
  }

  // The ancestors are now in order from closest to furthest, so reverse them
  ancestors.reverse();

  return ancestors;
}

async function getRootWorkspaceDirectory(): Promise<Uri | undefined> {
  // If there is a valid workspace file, just use its directory as the directory for the extensions
  const workspaceFile = workspace.workspaceFile;
  if (workspaceFile?.scheme === "file") {
    return Uri.joinPath(workspaceFile, "..");
  }

  const allWorkspaceFolders = getOnDiskWorkspaceFoldersObjects();

  // Get the system temp directory and convert it to a URI so it's normalized
  const systemTmpdir = Uri.file(tmpdir());

  const workspaceFolders = allWorkspaceFolders.filter((folder) => {
    // Never use a workspace folder that is in the system temp directory
    return !folder.uri.fsPath.startsWith(systemTmpdir.fsPath);
  });

  // Find the common root directory of all workspace folders by finding the longest common prefix
  const commonRoot = workspaceFolders.reduce((commonRoot, folder) => {
    const folderUri = folder.uri;
    const ancestors = getAncestors(folderUri);

    const minLength = Math.min(commonRoot.length, ancestors.length);
    let commonLength = 0;
    for (let i = 0; i < minLength; i++) {
      if (commonRoot[i].fsPath === ancestors[i].fsPath) {
        commonLength++;
      } else {
        break;
      }
    }

    return commonRoot.slice(0, commonLength);
  }, getAncestors(workspaceFolders[0].uri));

  if (commonRoot.length === 0) {
    return await findGitFolder(workspaceFolders);
  }

  // The path closest to the workspace folders is the last element of the common root
  const commonRootUri = commonRoot[commonRoot.length - 1];

  // If we are at the root of the filesystem, we can't go up any further and there's something
  // wrong, so just return undefined
  if (commonRootUri.fsPath === Uri.joinPath(commonRootUri, "..").fsPath) {
    return await findGitFolder(workspaceFolders);
  }

  return commonRootUri;
}

async function findGitFolder(
  workspaceFolders: WorkspaceFolder[],
): Promise<Uri | undefined> {
  // Go through all workspace folders one-by-one and try to find the closest .git folder for each one
  const folders = await Promise.all(
    workspaceFolders.map(async (folder) => {
      const ancestors = getAncestors(folder.uri);

      // Reverse the ancestors so we're going from closest to furthest
      ancestors.reverse();

      const gitFoldersExists = await Promise.all(
        ancestors.map(async (uri) => {
          const gitFolder = Uri.joinPath(uri, ".git");
          try {
            const stat = await workspace.fs.stat(gitFolder);
            // Check whether it's a directory
            return (stat.type & FileType.Directory) !== 0;
          } catch (e) {
            return false;
          }
        }),
      );

      // Find the first ancestor that has a .git folder
      const ancestorIndex = gitFoldersExists.findIndex((exists) => exists);

      if (ancestorIndex === -1) {
        return undefined;
      }

      return [ancestorIndex, ancestors[ancestorIndex]];
    }),
  );

  const validFolders = folders.filter(
    (folder): folder is [number, Uri] => folder !== undefined,
  );
  if (validFolders.length === 0) {
    return undefined;
  }

  // Find the .git folder which is closest to a workspace folder
  const closestFolder = validFolders.reduce((closestFolder, folder) => {
    if (folder[0] < closestFolder[0]) {
      return folder;
    }
    return closestFolder;
  }, validFolders[0]);

  return closestFolder?.[1];
}

/**
 * Finds a suitable directory for extension packs to be created in. This will
 * always be a path ending in `.github/codeql/extensions`. The parent directory
 * will be determined heuristically based on the on-disk workspace folders.
 *
 * The heuristic is as follows (`.github/codeql/extensions` is added automatically unless
 * otherwise specified):
 * 1. If there is only 1 workspace folder, use that folder
 * 2. If there is a workspace folder for which the path ends in `.github/codeql/extensions`, use that folder
 *   - If there are multiple such folders, use the first one
 *   - Does not append `.github/codeql/extensions` to the path
 * 3. If there is a workspace file (`<basename>.code-workspace`), use the directory containing that file
 * 4. If there is a common root directory for all workspace folders, use that directory
 *   - Workspace folders in the system temp directory are ignored
 *   - If the common root directory is the root of the filesystem, then it's not used
 * 5. If there is a .git directory in any workspace folder, use the directory containing that .git directory
 *    for which the .git directory is closest to a workspace folder
 * 6. If none of the above apply, return `undefined`
 */
export async function autoPickExtensionsDirectory(): Promise<Uri | undefined> {
  const workspaceFolders = getOnDiskWorkspaceFoldersObjects();

  // If there's only 1 workspace folder, use the `.github/codeql/extensions` directory in that folder
  if (workspaceFolders.length === 1) {
    return Uri.joinPath(
      workspaceFolders[0].uri,
      ".github",
      "codeql",
      "extensions",
    );
  }

  // Now try to find a workspace folder for which the path ends in `.github/codeql/extensions`
  const workspaceFolderForExtensions = workspaceFolders.find((folder) =>
    // Using path instead of fsPath because path always uses forward slashes
    folder.uri.path.endsWith(".github/codeql/extensions"),
  );
  if (workspaceFolderForExtensions) {
    return workspaceFolderForExtensions.uri;
  }

  // Get the root workspace directory, i.e. the common root directory of all workspace folders
  const rootDirectory = await getRootWorkspaceDirectory();
  if (!rootDirectory) {
    void extLogger.log("Unable to determine root workspace directory");

    return undefined;
  }

  // We'll create a new workspace folder for the extensions in the root workspace directory
  // at `.github/codeql/extensions`
  const extensionsUri = Uri.joinPath(
    rootDirectory,
    ".github",
    "codeql",
    "extensions",
  );

  if (
    !workspace.updateWorkspaceFolders(
      workspace.workspaceFolders?.length ?? 0,
      0,
      {
        name: "CodeQL Extension Packs",
        uri: extensionsUri,
      },
    )
  ) {
    void extLogger.log(
      `Failed to add workspace folder for extensions at ${extensionsUri.fsPath}`,
    );
    return undefined;
  }

  return extensionsUri;
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
