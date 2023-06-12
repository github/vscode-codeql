import { pathExists, stat, readdir } from "fs-extra";
import { isAbsolute, join, relative, resolve } from "path";

/**
 * Recursively finds all .ql files in this set of Uris.
 *
 * @param paths The list of Uris to search through
 *
 * @returns list of ql files and a boolean describing whether or not a directory was found/
 */
export async function gatherQlFiles(
  paths: string[],
): Promise<[string[], boolean]> {
  const gatheredUris: Set<string> = new Set();
  let dirFound = false;
  for (const nextPath of paths) {
    if ((await pathExists(nextPath)) && (await stat(nextPath)).isDirectory()) {
      dirFound = true;
      const subPaths = await readdir(nextPath);
      const fullPaths = subPaths.map((p) => join(nextPath, p));
      const nestedFiles = (await gatherQlFiles(fullPaths))[0];
      nestedFiles.forEach((nested) => gatheredUris.add(nested));
    } else if (nextPath.endsWith(".ql")) {
      gatheredUris.add(nextPath);
    }
  }
  return [Array.from(gatheredUris), dirFound];
}

/**
 * Lists the names of directories inside the given path.
 * @param path The path to the directory to read.
 * @returns the names of the directories inside the given path.
 */
export async function getDirectoryNamesInsidePath(
  path: string,
): Promise<string[]> {
  if (!(await pathExists(path))) {
    throw Error(`Path does not exist: ${path}`);
  }
  if (!(await stat(path)).isDirectory()) {
    throw Error(`Path is not a directory: ${path}`);
  }

  const dirItems = await readdir(path, { withFileTypes: true });

  const dirNames = dirItems
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  return dirNames;
}

function normalizePath(path: string): string {
  // On Windows, "C:/", "C:\", and "c:/" are all equivalent. We need
  // to normalize the paths to ensure they all get resolved to the
  // same format. On Windows, we also need to do the comparison
  // case-insensitively.
  path = resolve(path);
  if (process.platform === "win32") {
    path = path.toLowerCase();
  }
  return path;
}

export function pathsEqual(path1: string, path2: string): boolean {
  return normalizePath(path1) === normalizePath(path2);
}

/**
 * Returns true if `parent` contains `child`, or if they are equal.
 */
export function containsPath(parent: string, child: string): boolean {
  const relativePath = relative(parent, child);
  return (
    !relativePath.startsWith("..") &&
    // On windows, if the two paths are in different drives, then the
    // relative path will be an absolute path to the other drive.
    !isAbsolute(relativePath)
  );
}

export async function readDirFullPaths(path: string): Promise<string[]> {
  const baseNames = await readdir(path);
  return baseNames.map((baseName) => join(path, baseName));
}
