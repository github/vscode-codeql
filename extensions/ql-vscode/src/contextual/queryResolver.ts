import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import * as tmp from 'tmp-promise';

import * as helpers from '../helpers';
import {
  KeyType,
  kindOfKeyType,
  nameOfKeyType,
  tagOfKeyType
} from './keyType';
import { CodeQLCliServer } from '../cli';
import { DatabaseItem } from '../databases';
import { QlPacksForLanguage } from '../helpers';

export async function qlpackOfDatabase(cli: CodeQLCliServer, db: DatabaseItem): Promise<QlPacksForLanguage> {
  if (db.contents === undefined) {
    throw new Error('Database is invalid and cannot infer QLPack.');
  }
  const datasetPath = db.contents.datasetUri.fsPath;
  const dbscheme = await helpers.getPrimaryDbscheme(datasetPath);
  return await helpers.getQlPackForDbscheme(cli, dbscheme);
}

/**
 * Finds the contextual queries with the specified key in a list of CodeQL packs.
 *
 * @param cli The CLI instance to use.
 * @param qlpacks The list of packs to search.
 * @param keyType The contextual query key of the query to search for.
 * @returns The found queries from the first pack in which any matching queries were found.
 */
async function resolveQueriesFromPacks(cli: CodeQLCliServer, qlpacks: string[], keyType: KeyType): Promise<string[]> {
  const suiteFile = (await tmp.file({
    postfix: '.qls'
  })).path;
  const suiteYaml = [];
  for (const qlpack of qlpacks) {
    suiteYaml.push({
      from: qlpack,
      queries: '.',
      include: {
        kind: kindOfKeyType(keyType),
        'tags contain': tagOfKeyType(keyType)
      }
    });
  }
  await fs.writeFile(suiteFile, yaml.safeDump(suiteYaml), 'utf8');

  const queries = await cli.resolveQueriesInSuite(suiteFile, helpers.getOnDiskWorkspaceFolders());
  return queries;
}

export async function resolveQueries(cli: CodeQLCliServer, qlpacks: QlPacksForLanguage, keyType: KeyType): Promise<string[]> {
  const cliCanHandleLibraryPack = await cli.cliConstraints.supportsAllowLibraryPacksInResolveQueries();
  const packsToSearch: string[] = [];
  let blameCli: boolean;

  if (cliCanHandleLibraryPack) {
    // The CLI can handle both library packs and query packs, so search both packs in order.
    packsToSearch.push(qlpacks.dbschemePack);
    if (qlpacks.queryPack !== undefined) {
      packsToSearch.push(qlpacks.queryPack);
    }
    // If we don't find the query, it's because it's not there, not because the CLI was unable to
    // search the pack.
    blameCli = false;
  } else {
    // Older CLIs can't handle `codeql resolve queries` with a suite that references a library pack.
    if (qlpacks.dbschemePackIsLibraryPack) {
      if (qlpacks.queryPack !== undefined) {
        // Just search the query pack, because some older library/query releases still had the
        // contextual queries in the query pack.
        packsToSearch.push(qlpacks.queryPack);
      }
      // If we don't find it, it's because the CLI was unable to search the library pack that
      // actually contains the query. Blame any failure on the CLI, not the packs.
      blameCli = true;
    } else {
      // We have an old CLI, but the dbscheme pack is old enough that it's still a unified pack with
      // both libraries and queries. Just search that pack.
      packsToSearch.push(qlpacks.dbschemePack);
      // Any CLI should be able to search the single query pack, so if we don't find it, it's
      // because the language doesn't support it.
      blameCli = false;
    }
  }

  const queries = await resolveQueriesFromPacks(cli, packsToSearch, keyType);
  if (queries.length > 0) {
    return queries;
  }

  // No queries found. Determine the correct error message for the various scenarios.
  const errorMessage = blameCli ?
    `Your current version of the CodeQL CLI, '${(await cli.getVersion()).version}', \
    is unable to use contextual queries from recent versions of the standard CodeQL libraries. \
    Please upgrade to the latest version of the CodeQL CLI.`
    :
    `No ${nameOfKeyType(keyType)} queries (tagged "${tagOfKeyType(keyType)}") could be found in the current library path. \
    Try upgrading the CodeQL libraries. If that doesn't work, then ${nameOfKeyType(keyType)} queries are not yet available \
    for this language.`;

  void helpers.showAndLogErrorMessage(errorMessage);
  throw new Error(`Couldn't find any queries tagged ${tagOfKeyType(keyType)} in any of the following packs: ${packsToSearch.join(', ')}.`);
}
