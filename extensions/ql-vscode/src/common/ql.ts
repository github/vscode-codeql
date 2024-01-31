import { dirname, join, parse } from "path";
import { pathExists } from "fs-extra";

export const QLPACK_FILENAMES = ["qlpack.yml", "codeql-pack.yml"];
export const QLPACK_LOCK_FILENAMES = [
  "qlpack.lock.yml",
  "codeql-pack.lock.yml",
];
export const FALLBACK_QLPACK_FILENAME = QLPACK_FILENAMES[0];

/**
 * Gets the path to the QL pack file (a qlpack.yml or
 * codeql-pack.yml).
 * @param packRoot The root of the pack.
 * @returns The path to the qlpack file, or undefined if it doesn't exist.
 */
export async function getQlPackFilePath(
  packRoot: string,
): Promise<string | undefined> {
  for (const filename of QLPACK_FILENAMES) {
    const path = join(packRoot, filename);

    if (await pathExists(path)) {
      return path;
    }
  }

  return undefined;
}

/**
 * Recursively find the directory containing qlpack.yml or codeql-pack.yml. If
 * no such directory is found, the directory containing the query file is returned.
 * @param queryFile The query file to start from.
 * @returns The path to the pack root or undefined if it doesn't exist.
 */
export async function findPackRoot(
  queryFile: string,
): Promise<string | undefined> {
  let dir = dirname(queryFile);
  while (!(await getQlPackFilePath(dir))) {
    dir = dirname(dir);
    if (isFileSystemRoot(dir)) {
      return undefined;
    }
  }

  return dir;
}

function isFileSystemRoot(dir: string): boolean {
  const pathObj = parse(dir);
  return pathObj.root === dir && pathObj.base === "";
}
