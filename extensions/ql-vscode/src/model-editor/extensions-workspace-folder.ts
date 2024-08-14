import type { WorkspaceFolder } from "vscode";
import { FileType, Uri, workspace } from "vscode";
import { getOnDiskWorkspaceFoldersObjects } from "../common/vscode/workspace-folders";
import { containsPath, tmpdir } from "../common/files";
import type { NotificationLogger } from "../common/logging";
import { showAndLogErrorMessage } from "../common/logging";
import { isAbsolute, normalize, resolve } from "path";
import { nanoid } from "nanoid";
import type { ModelConfig } from "../config";

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

function findCommonAncestor(uris: Uri[]): Uri | undefined {
  if (uris.length === 0) {
    return undefined;
  }

  if (uris.length === 1) {
    return uris[0];
  }

  // Find the common root directory of all workspace folders by finding the longest common prefix
  const commonRoot = uris.reduce((commonRoot, folderUri) => {
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
  }, getAncestors(uris[0]));

  if (commonRoot.length === 0) {
    return undefined;
  }

  // The path closest to the workspace folders is the last element of the common root
  const commonRootUri = commonRoot[commonRoot.length - 1];

  // If we are at the root of the filesystem, we can't go up any further and there's something
  // wrong, so just return undefined
  if (commonRootUri.fsPath === Uri.joinPath(commonRootUri, "..").fsPath) {
    return undefined;
  }

  return commonRootUri;
}

/**
 * Finds the root directory of this workspace. It is determined
 * heuristically based on the on-disk workspace folders.
 *
 * The heuristic is as follows:
 * 1. If there is a workspace file (`<basename>.code-workspace`), use the directory containing that file
 * 2. If there is only 1 workspace folder, use that folder
 * 3. If there is a common root directory for all workspace folders, use that directory
 *   - Workspace folders in the system temp directory are ignored
 *   - If the common root directory is the root of the filesystem, then it's not used
 * 4. If there is a .git directory in any workspace folder, use the directory containing that .git directory
 *    for which the .git directory is closest to a workspace folder
 * 5. If none of the above apply, return `undefined`
 */
export async function getRootWorkspaceDirectory(): Promise<Uri | undefined> {
  // If there is a valid workspace file, just use its directory as the directory for the extensions
  const workspaceFile = workspace.workspaceFile;
  if (workspaceFile?.scheme === "file") {
    return Uri.joinPath(workspaceFile, "..");
  }

  const allWorkspaceFolders = getOnDiskWorkspaceFoldersObjects();

  if (allWorkspaceFolders.length === 1) {
    return allWorkspaceFolders[0].uri;
  }

  // Get the system temp directory and convert it to a URI so it's normalized
  const systemTmpdir = Uri.file(tmpdir());

  const workspaceFolders = allWorkspaceFolders.filter((folder) => {
    // Never use a workspace folder that is in the system temp directory
    return !folder.uri.fsPath.startsWith(systemTmpdir.fsPath);
  });

  // The path closest to the workspace folders is the last element of the common root
  const commonRootUri = findCommonAncestor(
    workspaceFolders.map((folder) => folder.uri),
  );

  // If there is no common root URI, try to find a .git folder in the workspace folders
  if (commonRootUri === undefined) {
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
          } catch {
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

export async function packLocationToAbsolute(
  packLocation: string,
  logger: NotificationLogger,
): Promise<string | undefined> {
  let userPackLocation = packLocation.trim();

  if (!isAbsolute(userPackLocation)) {
    const rootDirectory = await getRootWorkspaceDirectory();
    if (!rootDirectory) {
      void logger.log("Unable to determine root workspace directory");

      return undefined;
    }

    userPackLocation = resolve(rootDirectory.fsPath, userPackLocation);
  }

  userPackLocation = normalize(userPackLocation);

  if (!isAbsolute(userPackLocation)) {
    // This shouldn't happen, but just in case
    void showAndLogErrorMessage(
      logger,
      `Invalid pack location: ${userPackLocation}`,
    );

    return undefined;
  }

  // If we are at the root of the filesystem, then something is wrong since
  // this should never be the location of a pack
  if (userPackLocation === resolve(userPackLocation, "..")) {
    void showAndLogErrorMessage(
      logger,
      `Invalid pack location: ${userPackLocation}`,
    );

    return undefined;
  }

  return userPackLocation;
}

/**
 * This function will try to add the pack location as a workspace folder if it's not already in a
 * workspace folder and the workspace is a multi-root workspace.
 */
export async function ensurePackLocationIsInWorkspaceFolder(
  packLocation: string,
  modelConfig: ModelConfig,
  logger: NotificationLogger,
): Promise<void> {
  const workspaceFolders = getOnDiskWorkspaceFoldersObjects();

  const existsInWorkspaceFolder = workspaceFolders.some((folder) =>
    containsPath(folder.uri.fsPath, packLocation),
  );

  if (existsInWorkspaceFolder) {
    // If the pack location is already in a workspace folder, we don't need to do anything
    return;
  }

  if (workspace.workspaceFile === undefined) {
    // If we're not in a workspace, we can't add a workspace folder without reloading the window,
    // so we'll not do anything
    return;
  }

  // To find the "correct" directory to add as a workspace folder, we'll generate a few different
  // pack locations and find the common ancestor of the directories. This is the directory that
  // we'll add as a workspace folder.

  // Generate a few different pack locations to get an accurate common ancestor
  const otherPackLocations = await Promise.all(
    Array.from({ length: 3 }).map(() =>
      packLocationToAbsolute(
        modelConfig.getPackLocation(nanoid(), {
          database: nanoid(),
          language: nanoid(),
          name: nanoid(),
          owner: nanoid(),
        }),
        logger,
      ),
    ),
  );

  const otherPackLocationUris = otherPackLocations
    .filter((loc): loc is string => loc !== undefined)
    .map((loc) => Uri.file(loc));

  if (otherPackLocationUris.length === 0) {
    void logger.log(
      `Failed to generate different pack locations, not adding workspace folder.`,
    );
    return;
  }

  const commonRootUri = findCommonAncestor([
    Uri.file(packLocation),
    ...otherPackLocationUris,
  ]);

  if (commonRootUri === undefined) {
    void logger.log(
      `Failed to find common ancestor for ${packLocation} and ${otherPackLocationUris[0].fsPath}, not adding workspace folder.`,
    );
    return;
  }

  if (
    !workspace.updateWorkspaceFolders(
      workspace.workspaceFolders?.length ?? 0,
      0,
      {
        name: "CodeQL Extension Packs",
        uri: commonRootUri,
      },
    )
  ) {
    void logger.log(
      `Failed to add workspace folder for extensions at ${commonRootUri.fsPath}`,
    );
    return;
  }
}
