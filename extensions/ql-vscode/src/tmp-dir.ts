import { dirSync } from "tmp-promise";
import { extLogger } from "./common/logging/vscode";

// Shared temporary folder for the extension.
export const tmpDir = dirSync({
  prefix: "queries_",
  keep: false,
  unsafeCleanup: true,
});

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
