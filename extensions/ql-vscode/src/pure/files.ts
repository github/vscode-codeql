import * as fs from 'fs-extra';
import * as path from 'path';


/**
 * Recursively finds all .ql files in this set of Uris.
 *
 * @param paths The list of Uris to search through
 *
 * @returns list of ql files and a boolean describing whether or not a directory was found/
 */
export async function gatherQlFiles(paths: string[]): Promise<[string[], boolean]> {
  const gatheredUris: Set<string> = new Set();
  let dirFound = false;
  for (const nextPath of paths) {
    if (
      (await fs.pathExists(nextPath)) &&
      (await fs.stat(nextPath)).isDirectory()
    ) {
      dirFound = true;
      const subPaths = await fs.readdir(nextPath);
      const fullPaths = subPaths.map(p => path.join(nextPath, p));
      const nestedFiles = (await gatherQlFiles(fullPaths))[0];
      nestedFiles.forEach(nested => gatheredUris.add(nested));
    } else if (nextPath.endsWith('.ql')) {
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
export async function getDirectoryNamesInsidePath(path: string): Promise<string[]> {
  if (!(await fs.pathExists(path))) {
    throw Error(`Path does not exist: ${path}`);
  }
  if (!(await fs.stat(path)).isDirectory()) {
    throw Error(`Path is not a directory: ${path}`);
  }

  const dirItems = await fs.readdir(path, { withFileTypes: true });

  const dirNames = dirItems
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  return dirNames;
}
