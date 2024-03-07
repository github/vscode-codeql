import { pathExists, stat, readdir, opendir, lstatSync } from "fs-extra";
import { dirname, isAbsolute, join, relative, resolve } from "path";
import { tmpdir as osTmpdir } from "os";

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

export function normalizePath(path: string): string {
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

/**
 * Recursively walk a directory and return the full path to all files found.
 * Symbolic links are ignored.
 *
 * @param dir the directory to walk
 * @param includeDirectories whether to include directories in the results
 *
 * @return An iterator of the full path to all files recursively found in the directory.
 */
export async function* walkDirectory(
  dir: string,
  includeDirectories = false,
): AsyncIterableIterator<string> {
  const seenFiles = new Set<string>();
  for await (const d of await opendir(dir)) {
    const entry = join(dir, d.name);
    seenFiles.add(entry);
    if (d.isDirectory()) {
      if (includeDirectories) {
        yield entry;
      }
      yield* walkDirectory(entry, includeDirectories);
    } else if (d.isFile()) {
      yield entry;
    }
  }
}

/**
 * Error thrown from methods from the `fs` module.
 *
 * In practice, any error matching this is likely an instance of `NodeJS.ErrnoException`.
 * If desired in the future, we could model more fields or use `NodeJS.ErrnoException` directly.
 */
export interface IOError {
  readonly code: string;
}

export function isIOError(e: unknown): e is IOError {
  return (
    e !== undefined &&
    e !== null &&
    typeof e === "object" &&
    "code" in e &&
    typeof e.code === "string"
  );
}

// This function is a wrapper around `os.tmpdir()` to make it easier to mock in tests.
export function tmpdir(): string {
  return osTmpdir();
}

/**
 * Finds the common parent directory of an arbitrary number of absolute paths. The result
 * will be an absolute path.
 * @param paths The array of paths.
 * @returns The common parent directory of the paths.
 */
export function findCommonParentDir(...paths: string[]): string {
  if (paths.length === 0) {
    throw new Error("At least one path must be provided");
  }
  if (paths.some((path) => !isAbsolute(path))) {
    throw new Error("All paths must be absolute");
  }

  paths = paths.map((path) => normalizePath(path));

  // If there's only one path and it's a file, return its dirname
  if (paths.length === 1) {
    return lstatSync(paths[0]).isFile() ? dirname(paths[0]) : paths[0];
  }

  let commonDir = paths[0];
  while (!paths.every((path) => containsPath(commonDir, path))) {
    if (isTopLevelPath(commonDir)) {
      throw new Error(
        "Reached filesystem root and didn't find a common parent directory",
      );
    }
    commonDir = dirname(commonDir);
  }

  return commonDir;
}

function isTopLevelPath(path: string): boolean {
  return dirname(path) === path;
}

/**
 * Recursively looks for a file in a directory. If the file exists, then returns the directory containing the file.
 *
 * @param dir The directory to search
 * @param toFind The file to recursively look for in this directory
 *
 * @returns the directory containing the file, or undefined if not found.
 */
export async function findDirWithFile(
  dir: string,
  ...toFind: string[]
): Promise<string | undefined> {
  if (!(await stat(dir)).isDirectory()) {
    return;
  }
  const files = await readdir(dir);
  if (toFind.some((file) => files.includes(file))) {
    return dir;
  }
  for (const file of files) {
    const newPath = join(dir, file);
    const result = await findDirWithFile(newPath, ...toFind);
    if (result) {
      return result;
    }
  }
  return;
}
