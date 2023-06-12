import { ensureDirSync } from "fs-extra";
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
