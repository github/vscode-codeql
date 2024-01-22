import { join } from "path";
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
