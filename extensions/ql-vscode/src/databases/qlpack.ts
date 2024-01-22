import { window } from "vscode";
import { glob } from "glob";
import { basename } from "path";
import { load } from "js-yaml";
import { readFile } from "fs-extra";
import { getQlPackFilePath } from "../common/ql";
import type { CodeQLCliServer, QlpacksInfo } from "../codeql-cli/cli";
import { extLogger } from "../common/logging/vscode";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";

export interface QlPacksForLanguage {
  /** The name of the pack containing the dbscheme. */
  dbschemePack: string;
  /** `true` if `dbschemePack` is a library pack. */
  dbschemePackIsLibraryPack: boolean;
  /**
   * The name of the corresponding standard query pack.
   * Only defined if `dbschemePack` is a library pack.
   */
  queryPack?: string;
}

interface QlPackWithPath {
  packName: string;
  packDir: string | undefined;
}

async function findDbschemePack(
  packs: QlPackWithPath[],
  dbschemePath: string,
): Promise<{ name: string; isLibraryPack: boolean }> {
  for (const { packDir, packName } of packs) {
    if (packDir !== undefined) {
      const qlpackPath = await getQlPackFilePath(packDir);

      if (qlpackPath !== undefined) {
        const qlpack = load(await readFile(qlpackPath, "utf8")) as {
          dbscheme?: string;
          library?: boolean;
        };
        if (
          qlpack.dbscheme !== undefined &&
          basename(qlpack.dbscheme) === basename(dbschemePath)
        ) {
          return {
            name: packName,
            isLibraryPack: qlpack.library === true,
          };
        }
      }
    }
  }
  throw new Error(`Could not find qlpack file for dbscheme ${dbschemePath}`);
}

function findStandardQueryPack(
  qlpacks: QlpacksInfo,
  dbschemePackName: string,
): string | undefined {
  const matches = dbschemePackName.match(/^codeql\/(?<language>[a-z]+)-all$/);
  if (matches) {
    const queryPackName = `codeql/${matches.groups!.language}-queries`;
    if (qlpacks[queryPackName] !== undefined) {
      return queryPackName;
    }
  }

  // Either the dbscheme pack didn't look like one where the queries might be in the query pack, or
  // no query pack was found in the search path. Either is OK.
  return undefined;
}

export async function getQlPackForDbscheme(
  cliServer: Pick<CodeQLCliServer, "resolveQlpacks">,
  dbschemePath: string,
): Promise<QlPacksForLanguage> {
  const qlpacks = await cliServer.resolveQlpacks(getOnDiskWorkspaceFolders());
  const packs: QlPackWithPath[] = Object.entries(qlpacks).map(
    ([packName, dirs]) => {
      if (dirs.length < 1) {
        void extLogger.log(
          `In getQlPackFor ${dbschemePath}, qlpack ${packName} has no directories`,
        );
        return { packName, packDir: undefined };
      }
      if (dirs.length > 1) {
        void extLogger.log(
          `In getQlPackFor ${dbschemePath}, qlpack ${packName} has more than one directory; arbitrarily choosing the first`,
        );
      }
      return {
        packName,
        packDir: dirs[0],
      };
    },
  );
  const dbschemePack = await findDbschemePack(packs, dbschemePath);
  const queryPack = dbschemePack.isLibraryPack
    ? findStandardQueryPack(qlpacks, dbschemePack.name)
    : undefined;
  return {
    dbschemePack: dbschemePack.name,
    dbschemePackIsLibraryPack: dbschemePack.isLibraryPack,
    queryPack,
  };
}

export async function getPrimaryDbscheme(
  datasetFolder: string,
): Promise<string> {
  const dbschemes = await glob("*.dbscheme", {
    cwd: datasetFolder,
  });

  if (dbschemes.length < 1) {
    throw new Error(
      `Can't find dbscheme for current database in ${datasetFolder}`,
    );
  }

  dbschemes.sort();
  const dbscheme = dbschemes[0];

  if (dbschemes.length > 1) {
    void window.showErrorMessage(
      `Found multiple dbschemes in ${datasetFolder} during quick query; arbitrarily choosing the first, ${dbscheme}, to decide what library to use.`,
    );
  }
  return dbscheme;
}
