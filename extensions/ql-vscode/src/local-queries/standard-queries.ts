import type { CodeQLCliServer } from "../codeql-cli/cli";
import { QLPACK_FILENAMES, QLPACK_LOCK_FILENAMES } from "../common/ql";
import { basename, dirname, resolve } from "path";
import { extLogger } from "../common/logging/vscode";
import { promises } from "fs-extra";
import type { BaseLogger } from "../common/logging";

type LockFileForStandardQueryResult = {
  cleanup?: () => Promise<void>;
};

/**
 * Create a temporary query suite for a given query living within the standard library packs.
 *
 * This will create a lock file so the CLI can run the query without having the ql submodule.
 */
export async function createLockFileForStandardQuery(
  cli: CodeQLCliServer,
  queryPath: string,
  logger: BaseLogger = extLogger,
): Promise<LockFileForStandardQueryResult> {
  // These queries live within the standard library packs.
  // This simplifies distribution (you don't need the standard query pack to use the AST viewer),
  // but if the library pack doesn't have a lockfile, we won't be able to find
  // other pack dependencies of the library pack.

  // Work out the enclosing pack.
  const packContents = await cli.packPacklist(queryPath, false);
  const packFilePath = packContents.find((p) =>
    QLPACK_FILENAMES.includes(basename(p)),
  );
  if (packFilePath === undefined) {
    // Should not happen; we already resolved this query.
    throw new Error(
      `Could not find a CodeQL pack file for the pack enclosing the contextual query ${queryPath}`,
    );
  }
  const packPath = dirname(packFilePath);
  const lockFilePath = packContents.find((p) =>
    QLPACK_LOCK_FILENAMES.includes(basename(p)),
  );

  let cleanup: (() => Promise<void>) | undefined = undefined;

  if (!lockFilePath) {
    // No lock file, likely because this library pack is in the package cache.
    // Create a lock file so that we can resolve dependencies and library path
    // for the contextual query.
    void logger.log(
      `Library pack ${packPath} is missing a lock file; creating a temporary lock file`,
    );
    await cli.packResolveDependencies(packPath);

    cleanup = async () => {
      const tempLockFilePath = resolve(packPath, "codeql-pack.lock.yml");
      void logger.log(
        `Deleting temporary package lock file at ${tempLockFilePath}`,
      );
      // It's fine if the file doesn't exist.
      await promises.rm(resolve(packPath, "codeql-pack.lock.yml"), {
        force: true,
      });
    };

    // Clear CLI server pack cache before installing dependencies,
    // so that it picks up the new lock file, not the previously cached pack.
    void logger.log("Clearing the CodeQL CLI server's pack cache");
    await cli.clearCache();
    // Install dependencies.
    void logger.log(
      `Installing package dependencies for library pack ${packPath}`,
    );
    await cli.packInstall(packPath);
  }

  return { cleanup };
}
