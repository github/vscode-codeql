import {
  decodeSourceArchiveUri,
  encodeArchiveBasePath,
} from "../../common/vscode/archive-filesystem-provider";
import type {
  BqrsEntityValue,
  BqrsResultSetSchema,
} from "../../common/bqrs-cli-types";
import { BqrsColumnKindCode } from "../../common/bqrs-cli-types";
import type { CodeQLCliServer } from "../../codeql-cli/cli";
import type {
  DatabaseItem,
  DatabaseManager,
} from "../../databases/local-databases";
import type { ProgressCallback } from "../../common/vscode/progress";
import type { KeyType } from "./key-type";
import {
  resolveContextualQlPacksForDatabase,
  resolveContextualQueries,
  runContextualQuery,
} from "./query-resolver";
import type { CancellationToken, LocationLink } from "vscode";
import { Uri } from "vscode";
import type { QueryOutputDir } from "../../local-queries/query-output-dir";
import type { QueryRunner } from "../../query-server";
import { QueryResultType } from "../../query-server/messages";
import { fileRangeFromURI } from "./file-range-from-uri";

export const SELECT_QUERY_NAME = "#select";
export const SELECTED_SOURCE_FILE = "selectedSourceFile";
export const SELECTED_SOURCE_LINE = "selectedSourceLine";
export const SELECTED_SOURCE_COLUMN = "selectedSourceColumn";

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

  const qlpack = await resolveContextualQlPacksForDatabase(cli, db);
  const templates = createTemplates(uri.pathWithinSourceArchive);

  const links: FullLocationLink[] = [];
  for (const query of await resolveContextualQueries(cli, qlpack, keyType)) {
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
    if (results.resultType === QueryResultType.SUCCESS) {
      links.push(
        ...(await getLinksFromResults(results.outputDir, cli, db, filter)),
      );
    }
  }
  return links;
}

async function getLinksFromResults(
  outputDir: QueryOutputDir,
  cli: CodeQLCliServer,
  db: DatabaseItem,
  filter: (srcFile: string, destFile: string) => boolean,
): Promise<FullLocationLink[]> {
  const localLinks: FullLocationLink[] = [];
  const bqrsPath = outputDir.bqrsPath;
  const info = await cli.bqrsInfo(bqrsPath);
  const selectInfo = info["result-sets"].find(
    (schema) => schema.name === SELECT_QUERY_NAME,
  );
  if (isValidSelect(selectInfo)) {
    // TODO: Page this
    const allTuples = await cli.bqrsDecode(bqrsPath, SELECT_QUERY_NAME);
    for (const tuple of allTuples.tuples) {
      const [src, dest] = tuple as [BqrsEntityValue, BqrsEntityValue];
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
    [SELECTED_SOURCE_FILE]: path,
  };
}

function isValidSelect(selectInfo: BqrsResultSetSchema | undefined) {
  return (
    selectInfo &&
    selectInfo.columns.length === 3 &&
    selectInfo.columns[0].kind === BqrsColumnKindCode.ENTITY &&
    selectInfo.columns[1].kind === BqrsColumnKindCode.ENTITY &&
    selectInfo.columns[2].kind === BqrsColumnKindCode.STRING
  );
}
