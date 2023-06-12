import { ensureDir, ensureDirSync, writeFile } from "fs-extra";
import { join } from "path";
import { dirSync } from "tmp-promise";
import { extLogger } from "./common";

// Shared temporary folder for the extension.
export const tmpDir = dirSync({
  prefix: "queries_",
  keep: false,
  unsafeCleanup: true,
});
export const upgradesTmpDir = join(tmpDir.name, "upgrades");
ensureDirSync(upgradesTmpDir);

export const tmpDirDisposal = {
  dispose: () => {
    try {
      tmpDir.removeCallback();
    } catch (e) {
      void extLogger.log(
        `Failed to remove temporary directory ${tmpDir.name}: ${e}`,
      );
    }
  },
};

/**
 * Creates a file in the query directory that indicates when this query was created.
 * This is important for keeping track of when queries should be removed.
 *
 * @param queryPath The directory that will contain all files relevant to a query result.
 * It does not need to exist.
 */
export async function createTimestampFile(storagePath: string) {
  const timestampPath = join(storagePath, "timestamp");
  await ensureDir(storagePath);
  await writeFile(timestampPath, Date.now().toString(), "utf8");
}
