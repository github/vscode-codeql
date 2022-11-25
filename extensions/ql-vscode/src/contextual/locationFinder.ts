import {
  decodeSourceArchiveUri,
  encodeArchiveBasePath,
} from "../archive-filesystem-provider";
import {
  ColumnKindCode,
  EntityValue,
  getResultSetSchema,
  ResultSetSchema,
} from "../pure/bqrs-cli-types";
import { CodeQLCliServer } from "../cli";
import { DatabaseManager, DatabaseItem } from "../databases";
import fileRangeFromURI from "./fileRangeFromURI";
import { ProgressCallback } from "../commandRunner";
import { KeyType } from "./keyType";
import {
  qlpackOfDatabase,
  resolveQueries,
  runContextualQuery,
} from "./queryResolver";
import { CancellationToken, LocationLink, Uri } from "vscode";
import { QueryWithResults } from "../run-queries-shared";
import { QueryRunner } from "../queryRunner";

export const SELECT_QUERY_NAME = "#select";
export const TEMPLATE_NAME = "selectedSourceFile";

export interface FullLocationLink extends LocationLink {
  originUri: Uri;
}

/**
 * This function executes a contextual query inside a given database, filters, and converts
 * the results into source locations. This function is the workhorse for all search-based
 * contextual queries like find references and find definitions.
 *
 * @param cli The cli server
 * @param qs The query server client
 * @param dbm The database manager
 * @param uriString The selected source file and location
 * @param keyType The contextual query type to run
 * @param queryStorageDir The directory to store the query results
 * @param progress A progress callback
 * @param token A CancellationToken
 * @param filter A function that will filter extraneous results
 */
export async function getLocationsForUriString(
  cli: CodeQLCliServer,
  qs: QueryRunner,
  dbm: DatabaseManager,
  uriString: string,
  keyType: KeyType,
  queryStorageDir: string,
  progress: ProgressCallback,
  token: CancellationToken,
  filter: (src: string, dest: string) => boolean,
): Promise<FullLocationLink[]> {
  const uri = decodeSourceArchiveUri(Uri.parse(uriString, true));
  const sourceArchiveUri = encodeArchiveBasePath(uri.sourceArchiveZipPath);

  const db = dbm.findDatabaseItemBySourceArchive(sourceArchiveUri);
  if (!db) {
    return [];
  }

  const qlpack = await qlpackOfDatabase(cli, db);
  const templates = createTemplates(uri.pathWithinSourceArchive);

  const links: FullLocationLink[] = [];
  for (const query of await resolveQueries(cli, qlpack, keyType)) {
    const results = await runContextualQuery(
      query,
      db,
      queryStorageDir,
      qs,
      cli,
      progress,
      token,
      templates,
    );
    if (results.successful) {
      links.push(...(await getLinksFromResults(results, cli, db, filter)));
    }
  }
  return links;
}

async function getLinksFromResults(
  results: QueryWithResults,
  cli: CodeQLCliServer,
  db: DatabaseItem,
  filter: (srcFile: string, destFile: string) => boolean,
): Promise<FullLocationLink[]> {
  const localLinks: FullLocationLink[] = [];
  const bqrsPath = results.query.resultsPaths.resultsPath;
  const info = await cli.bqrsInfo(bqrsPath);
  const selectInfo = getResultSetSchema(SELECT_QUERY_NAME, info);
  if (isValidSelect(selectInfo)) {
    // TODO: Page this
    const allTuples = await cli.bqrsDecode(bqrsPath, SELECT_QUERY_NAME);
    for (const tuple of allTuples.tuples) {
      const [src, dest] = tuple as [EntityValue, EntityValue];
      const srcFile = src.url && fileRangeFromURI(src.url, db);
      const destFile = dest.url && fileRangeFromURI(dest.url, db);
      if (
        srcFile &&
        destFile &&
        filter(srcFile.uri.toString(), destFile.uri.toString())
      ) {
        localLinks.push({
          targetRange: destFile.range,
          targetUri: destFile.uri,
          originSelectionRange: srcFile.range,
          originUri: srcFile.uri,
        });
      }
    }
  }
  return localLinks;
}

function createTemplates(path: string): Record<string, string> {
  return {
    [TEMPLATE_NAME]: path,
  };
}

function isValidSelect(selectInfo: ResultSetSchema | undefined) {
  return (
    selectInfo &&
    selectInfo.columns.length == 3 &&
    selectInfo.columns[0].kind == ColumnKindCode.ENTITY &&
    selectInfo.columns[1].kind == ColumnKindCode.ENTITY &&
    selectInfo.columns[2].kind == ColumnKindCode.STRING
  );
}
