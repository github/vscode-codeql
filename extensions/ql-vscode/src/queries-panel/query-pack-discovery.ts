import { basename, dirname } from "path";
import { CodeQLCliServer, QuerySetup } from "../codeql-cli/cli";
import { Event } from "vscode";
import { QueryLanguage, dbSchemeToLanguage } from "../common/query-language";
import { FALLBACK_QLPACK_FILENAME, QLPACK_FILENAMES } from "../pure/ql";
import { FilePathDiscovery } from "../common/vscode/file-path-discovery";
import { getErrorMessage } from "../pure/helpers-pure";
import { extLogger } from "../common/logging/vscode";
import { EOL } from "os";
import { containsPath } from "../pure/files";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";

export interface QueryPack {
  path: string;
  language: QueryLanguage | undefined;
}

/**
 * Discovers all query packs in the workspace.
 */
export class QueryPackDiscovery extends FilePathDiscovery<QueryPack> {
  constructor(private readonly cliServer: CodeQLCliServer) {
    super("Query Pack Discovery", `**/{${QLPACK_FILENAMES.join(",")}}`);
  }

  /**
   * Event that fires when the set of query packs in the workspace changes.
   */
  public get onDidChangeQueryPacks(): Event<void> {
    return this.onDidChangePathData;
  }

  /**
   * Given a path of a query file, locate the query pack that contains it and
   * return the language of that pack. Returns undefined if no pack is found
   * or the pack's language is unknown.
   */
  public getLanguageForQueryFile(queryPath: string): QueryLanguage | undefined {
    // Find all packs in a higher directory than the query
    const packs = this.getPathData().filter((queryPack) =>
      containsPath(dirname(queryPack.path), queryPath),
    );

    // Sort by descreasing path length to find the pack nearest the query
    packs.sort((a, b) => b.path.length - a.path.length);

    if (packs.length === 0) {
      return undefined;
    }

    if (packs.length === 1) {
      return packs[0].language;
    }

    // If the first two packs are from a different directory, then the first one is the nearest
    if (dirname(packs[0].path) !== dirname(packs[1].path)) {
      return packs[0].language;
    }

    // If the first two packs are from the same directory then look at the filenames
    if (basename(packs[0].path) === FALLBACK_QLPACK_FILENAME) {
      return packs[0].language;
    } else {
      return packs[1].language;
    }
  }

  protected async getDataForPath(path: string): Promise<QueryPack> {
    const language = await this.determinePackLanguage(path);
    return { path, language };
  }

  private async determinePackLanguage(
    path: string,
  ): Promise<QueryLanguage | undefined> {
    let packInfo: QuerySetup | undefined = undefined;
    try {
      packInfo = await this.cliServer.resolveLibraryPath(
        getOnDiskWorkspaceFolders(),
        path,
        true,
      );
    } catch (err) {
      void extLogger.log(
        `Query pack discovery failed to determine language for query pack: ${path}${EOL}Reason: ${getErrorMessage(
          err,
        )}`,
      );
    }
    if (packInfo?.dbscheme === undefined) {
      return undefined;
    }
    const dbscheme = basename(packInfo.dbscheme);
    return dbSchemeToLanguage[dbscheme];
  }

  protected pathIsRelevant(path: string): boolean {
    return QLPACK_FILENAMES.includes(basename(path));
  }

  protected shouldOverwriteExistingData(
    newPack: QueryPack,
    existingPack: QueryPack,
  ): boolean {
    return existingPack.language !== newPack.language;
  }
}
