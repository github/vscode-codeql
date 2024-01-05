import { basename, dirname } from "path";
import type { Event } from "vscode";
import type { QueryLanguage } from "../common/query-language";
import { FALLBACK_QLPACK_FILENAME, QLPACK_FILENAMES } from "../common/ql";
import { FilePathDiscovery } from "../common/vscode/file-path-discovery";
import { containsPath } from "../common/files";
import { getQlPackLanguage } from "../common/qlpack-language";
import { getErrorMessage } from "../common/helpers-pure";

interface QueryPack {
  path: string;
  language: QueryLanguage | undefined;
}

/**
 * Discovers all query packs in the workspace.
 */
export class QueryPackDiscovery extends FilePathDiscovery<QueryPack> {
  constructor() {
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
    const pathData = this.getPathData();
    if (pathData === undefined) {
      return undefined;
    }

    // Find all packs in a higher directory than the query
    const packs = pathData.filter((queryPack) =>
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
    let language: QueryLanguage | undefined;
    try {
      language = await getQlPackLanguage(path);
    } catch (err) {
      void this.logger.log(
        `Query pack discovery failed to determine language for query pack: ${path}\n\tReason: ${getErrorMessage(
          err,
        )}`,
      );
      language = undefined;
    }
    return { path, language };
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
