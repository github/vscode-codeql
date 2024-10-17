import type { ExtensionContext } from "vscode";
import { getDirectoryNamesInsidePath, isIOError } from "../../common/files";
import { sleep } from "../../common/time";
import type { BaseLogger } from "../../common/logging";
import { join } from "path";
import { getErrorMessage } from "../../common/helpers-pure";
import { pathExists, remove } from "fs-extra";

interface ExtensionManagedDistributionManager {
  folderIndex: number;
  distributionFolderPrefix: string;
}

interface DistributionDirectory {
  directoryName: string;
  folderIndex: number;
}

/**
 * This class is responsible for cleaning up old distributions that are no longer needed. In normal operation, this
 * should not be necessary as the old distribution is deleted when the distribution is updated. However, in some cases
 * the extension may leave behind old distribution which can result in a significant amount of space (> 100 GB) being
 * taking up by unused distributions.
 */
export class ExtensionManagedDistributionCleaner {
  constructor(
    private readonly extensionContext: ExtensionContext,
    private readonly logger: BaseLogger,
    private readonly manager: ExtensionManagedDistributionManager,
  ) {}

  public start() {
    // Intentionally starting this without waiting for it
    void this.cleanup().catch((e: unknown) => {
      void this.logger.log(
        `Failed to clean up old versions of the CLI: ${getErrorMessage(e)}`,
      );
    });
  }

  public async cleanup() {
    if (!(await pathExists(this.extensionContext.globalStorageUri.fsPath))) {
      return;
    }

    const currentFolderIndex = this.manager.folderIndex;

    const distributionDirectoryRegex = new RegExp(
      `^${this.manager.distributionFolderPrefix}(\\d+)$`,
    );

    const existingDirectories = await getDirectoryNamesInsidePath(
      this.extensionContext.globalStorageUri.fsPath,
    );
    const distributionDirectories = existingDirectories
      .map((dir): DistributionDirectory | null => {
        const match = dir.match(distributionDirectoryRegex);
        if (!match) {
          // When the folderIndex is 0, the distributionFolderPrefix is used as the directory name
          if (dir === this.manager.distributionFolderPrefix) {
            return {
              directoryName: dir,
              folderIndex: 0,
            };
          }

          return null;
        }

        return {
          directoryName: dir,
          folderIndex: parseInt(match[1]),
        };
      })
      .filter((dir) => dir !== null);

    // Clean up all directories that are older than the current one
    const cleanableDirectories = distributionDirectories.filter(
      (dir) => dir.folderIndex < currentFolderIndex,
    );

    if (cleanableDirectories.length === 0) {
      return;
    }

    // Shuffle the array so that multiple VS Code processes don't all try to clean up the same directory at the same time
    for (let i = cleanableDirectories.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cleanableDirectories[i], cleanableDirectories[j]] = [
        cleanableDirectories[j],
        cleanableDirectories[i],
      ];
    }

    void this.logger.log(
      `Cleaning up ${cleanableDirectories.length} old versions of the CLI.`,
    );

    for (const cleanableDirectory of cleanableDirectories) {
      // Wait 10 seconds between each cleanup to avoid overloading the system (even though the remove call should be async)
      await sleep(10_000);

      const path = join(
        this.extensionContext.globalStorageUri.fsPath,
        cleanableDirectory.directoryName,
      );

      // Delete this directory
      try {
        await remove(path);
      } catch (e) {
        if (isIOError(e) && e.code === "ENOENT") {
          // If the directory doesn't exist, that's fine
          continue;
        }

        void this.logger.log(
          `Tried to clean up an old version of the CLI at ${path} but encountered an error: ${getErrorMessage(e)}.`,
        );
      }
    }

    void this.logger.log(
      `Cleaned up ${cleanableDirectories.length} old versions of the CLI.`,
    );
  }
}
