import { join } from "path";
import { pathExists } from "fs-extra";

export const QLPACK_FILENAMES = ["qlpack.yml", "codeql-pack.yml"];
export const FALLBACK_QLPACK_FILENAME = QLPACK_FILENAMES[0];

export async function getQlPackPath(
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
