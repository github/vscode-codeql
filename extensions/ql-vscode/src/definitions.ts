import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import * as tmp from 'tmp';
import * as vscode from "vscode";
import { decodeSourceArchiveUri, zipArchiveScheme } from "./archive-filesystem-provider";
import { ColumnKindCode, EntityValue, getResultSetSchema, LineColumnLocation, UrlValue } from "./bqrs-cli-types";
import { CodeQLCliServer } from "./cli";
import { DatabaseItem, DatabaseManager } from "./databases";
import * as helpers from './helpers';
import { CachedOperation } from './helpers';
import * as messages from "./messages";
import { QueryServerClient } from "./queryserver-client";
import { compileAndRunQueryAgainstDatabase, QueryWithResults } from "./run-queries";

/**
 * Run templated CodeQL queries to find definitions and references in
 * source-language files. We may eventually want to find a way to
 * generalize this to other custom queries, e.g. showing dataflow to
 * or from a selected identifier.
 */

const TEMPLATE_NAME = "selectedSourceFile";
const SELECT_QUERY_NAME = "#select";

enum KeyType {
  DefinitionQuery = 'DefinitionQuery',
  ReferenceQuery = 'ReferenceQuery',
}

function tagOfKeyType(keyType: KeyType): string {
  switch (keyType) {
    case KeyType.DefinitionQuery: return "ide-contextual-queries/local-definitions";
    case KeyType.ReferenceQuery: return "ide-contextual-queries/local-references";
  }
}

function nameOfKeyType(keyType: KeyType): string {
  switch (keyType) {
    case KeyType.DefinitionQuery: return "definitions";
    case KeyType.ReferenceQuery: return "references";
  }
}

async function resolveQueries(cli: CodeQLCliServer, qlpack: string, keyType: KeyType): Promise<string[]> {
  const suiteFile = tmp.fileSync({ postfix: '.qls' }).name;
  const suiteYaml = { qlpack, include: { kind: 'definitions', 'tags contain': tagOfKeyType(keyType) } };
  await fs.writeFile(suiteFile, yaml.safeDump(suiteYaml), 'utf8');

  const queries = await cli.resolveQueriesInSuite(suiteFile, helpers.getOnDiskWorkspaceFolders());
  if (queries.length === 0) {
    vscode.window.showErrorMessage(
      `No ${nameOfKeyType(keyType)} queries (tagged "${tagOfKeyType(keyType)}") could be found in the current library path. It might be necessary to upgrade the CodeQL libraries.`
    );
    throw new Error(`Couldn't find any queries tagged ${tagOfKeyType(keyType)} for qlpack ${qlpack}`);
  }
  return queries;
}

async function qlpackOfDatabase(cli: CodeQLCliServer, db: DatabaseItem): Promise<string | undefined> {
  if (db.contents === undefined)
    return undefined;
  const datasetPath = db.contents.datasetUri.fsPath;
  const { qlpack } = await helpers.resolveDatasetFolder(cli, datasetPath);
  return qlpack;
}

interface FullLocationLink extends vscode.LocationLink {
  originUri: vscode.Uri;
}

export class TemplateQueryDefinitionProvider implements vscode.DefinitionProvider {
  private cache: CachedOperation<vscode.LocationLink[]>;

  constructor(
    private cli: CodeQLCliServer,
    private qs: QueryServerClient,
    private dbm: DatabaseManager,
  ) {
    this.cache = new CachedOperation<vscode.LocationLink[]>(this.getDefinitions.bind(this));
  }

  async getDefinitions(uriString: string): Promise<vscode.LocationLink[]> {
    return getLinksForUriString(this.cli, this.qs, this.dbm, uriString, KeyType.DefinitionQuery, (src, _dest) => src === uriString);
  }

  async provideDefinition(document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken): Promise<vscode.LocationLink[]> {
    const fileLinks = await this.cache.get(document.uri.toString());
    const locLinks: vscode.LocationLink[] = [];
    for (const link of fileLinks) {
      if (link.originSelectionRange!.contains(position)) {
        locLinks.push(link);
      }
    }
    return locLinks;
  }
}

export class TemplateQueryReferenceProvider implements vscode.ReferenceProvider {
  private cache: CachedOperation<FullLocationLink[]>;

  constructor(
    private cli: CodeQLCliServer,
    private qs: QueryServerClient,
    private dbm: DatabaseManager,
  ) {
    this.cache = new CachedOperation<FullLocationLink[]>(this.getReferences.bind(this));
  }

  async getReferences(uriString: string): Promise<FullLocationLink[]> {
    return getLinksForUriString(this.cli, this.qs, this.dbm, uriString, KeyType.ReferenceQuery, (_src, dest) => dest === uriString);
  }

  async provideReferences(document: vscode.TextDocument, position: vscode.Position, _context: vscode.ReferenceContext, _token: vscode.CancellationToken): Promise<vscode.Location[]> {
    const fileLinks = await this.cache.get(document.uri.toString());
    const locLinks: vscode.Location[] = [];
    for (const link of fileLinks) {
      if (link.targetRange!.contains(position)) {
        locLinks.push({ range: link.originSelectionRange!, uri: link.originUri });
      }
    }
    return locLinks;
  }
}

interface FileRange {
  file: vscode.Uri;
  range: vscode.Range;
}

async function getLinksFromResults(results: QueryWithResults, cli: CodeQLCliServer, db: DatabaseItem, filter: (srcFile: string, destFile: string) => boolean): Promise<FullLocationLink[]> {
  const localLinks: FullLocationLink[] = [];
  const bqrsPath = results.query.resultsPaths.resultsPath;
  const info = await cli.bqrsInfo(bqrsPath);
  const selectInfo = getResultSetSchema(SELECT_QUERY_NAME, info);
  if (selectInfo && selectInfo.columns.length == 3
    && selectInfo.columns[0].kind == ColumnKindCode.ENTITY
    && selectInfo.columns[1].kind == ColumnKindCode.ENTITY
    && selectInfo.columns[2].kind == ColumnKindCode.STRING) {
    // TODO: Page this
    const allTuples = await cli.bqrsDecode(bqrsPath, SELECT_QUERY_NAME);
    for (const tuple of allTuples.tuples) {
      const src = tuple[0] as EntityValue;
      const dest = tuple[1] as EntityValue;
      const srcFile = src.url && fileRangeFromURI(src.url, db);
      const destFile = dest.url && fileRangeFromURI(dest.url, db);
      if (srcFile && destFile && filter(srcFile.file.toString(), destFile.file.toString())) {
        localLinks.push({ targetRange: destFile.range, targetUri: destFile.file, originSelectionRange: srcFile.range, originUri: srcFile.file });
      }
    }
  }
  return localLinks;
}

async function getLinksForUriString(
  cli: CodeQLCliServer,
  qs: QueryServerClient,
  dbm: DatabaseManager,
  uriString: string,
  keyType: KeyType,
  filter: (src: string, dest: string) => boolean
) {
  const uri = decodeSourceArchiveUri(vscode.Uri.parse(uriString));
  const sourceArchiveUri = vscode.Uri.file(uri.sourceArchiveZipPath).with({ scheme: zipArchiveScheme });

  const db = dbm.findDatabaseItemBySourceArchive(sourceArchiveUri);
  if (db) {
    const qlpack = await qlpackOfDatabase(cli, db);
    if (qlpack === undefined) {
      throw new Error("Can't infer qlpack from database source archive");
    }
    const links: FullLocationLink[] = [];
    for (const query of await resolveQueries(cli, qlpack, keyType)) {
      const templates: messages.TemplateDefinitions = {
        [TEMPLATE_NAME]: {
          values: {
            tuples: [[{
              stringValue: uri.pathWithinSourceArchive
            }]]
          }
        }
      };
      const results = await compileAndRunQueryAgainstDatabase(cli, qs, db, false, vscode.Uri.file(query), templates);
      if (results.result.resultType == messages.QueryResultType.SUCCESS) {
        links.push(...await getLinksFromResults(results, cli, db, filter));
      }
    }
    return links;
  } else {
    return [];
  }
}

function fileRangeFromURI(uri: UrlValue, db: DatabaseItem): FileRange | undefined {
  if (typeof uri === "string") {
    return undefined;
  } else if ('startOffset' in uri) {
    return undefined;
  } else {
    const loc = uri as LineColumnLocation;
    const range = new vscode.Range(Math.max(0, loc.startLine - 1),
      Math.max(0, loc.startColumn - 1),
      Math.max(0, loc.endLine - 1),
      Math.max(0, loc.endColumn));
    try {
      const parsed = vscode.Uri.parse(uri.uri, true);
      if (parsed.scheme === "file") {
        return { file: db.resolveSourceFile(parsed.fsPath), range };
      }
      return undefined;
    } catch (e) {
      return undefined;
    }
  }
}
