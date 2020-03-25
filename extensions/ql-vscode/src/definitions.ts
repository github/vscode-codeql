import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import * as tmp from 'tmp';
import * as vscode from "vscode";
import { decodeSourceArchiveUri, zipArchiveScheme } from "./archive-filesystem-provider";
import { EntityValue, getResultSetSchema, LineColumnLocation, UrlValue } from "./bqrs-cli-types";
import { CodeQLCliServer } from "./cli";
import { DatabaseItem, DatabaseManager } from "./databases";
import * as helpers from './helpers';
import * as messages from "./messages";
import { QueryServerClient } from "./queryserver-client";
import { compileAndRunQueryAgainstDatabase, QueryWithResults } from "./run-queries";

const TEMPLATE_NAME = "selectedSourceFile";
const SELECT_QUERY_NAME = "#select";

enum KeyType {
  DefinitionQuery, ReferenceQuery
}

function tagOfKeyType(keyType: KeyType): string {
  switch (keyType) {
    case KeyType.DefinitionQuery: return "local-definitions";
    case KeyType.ReferenceQuery: return "local-references";
  }
}

async function resolveQueries(cli: CodeQLCliServer, qlpack: string, keyType: KeyType): Promise<string[]> {
  const suiteFile = tmp.fileSync({ postfix: '.qls' }).name;
  const suiteYaml = { qlpack, include: { kind: 'definitions', 'tags contain': tagOfKeyType(keyType) } };
  await fs.writeFile(suiteFile, yaml.safeDump(suiteYaml), 'utf8');

  const queries = await cli.resolveQueriesInSuite(suiteFile, helpers.getOnDiskWorkspaceFolders());
  if (queries.length === 0) {
    throw new Error("Couldn't find any queries for qlpack");
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

export async function createDefinitionsHandler(cli: CodeQLCliServer, qs: QueryServerClient, dbm: DatabaseManager): Promise<vscode.DefinitionProvider> {
  let fileCache = new CachedOperation<vscode.LocationLink[]>(async (uriString: string) => {
    const uri = decodeSourceArchiveUri(vscode.Uri.parse(uriString));
    const sourceArchiveUri = vscode.Uri.file(uri.sourceArchiveZipPath).with({ scheme: zipArchiveScheme });

    const db = dbm.findDatabaseItemBySourceArchive(sourceArchiveUri);
    if (db) {
      const qlpack = await qlpackOfDatabase(cli, db);
      if (qlpack === undefined) {
        throw new Error("Can't infer qlpack from database source archive");
      }
      const links: vscode.DefinitionLink[] = []
      for (const query of await resolveQueries(cli, qlpack, KeyType.DefinitionQuery)) {
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
          links.push(...await getLinksFromResults(results, cli, db, (src, _dest) => src === uriString));
        }
      }
      return links;
    } else {
      return [];
    }
  });

  return {
    async provideDefinition(document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken): Promise<vscode.LocationLink[]> {
      const fileLinks = await fileCache.get(document.uri.toString());
      let locLinks: vscode.LocationLink[] = [];
      for (const link of fileLinks) {
        if (link.originSelectionRange!.contains(position)) {
          locLinks.push(link);
        }
      }
      return locLinks;
    }

  };
}

interface FullLocationLink extends vscode.LocationLink {
  originUri: vscode.Uri;
}

export async function createReferencesHander(cli: CodeQLCliServer, qs: QueryServerClient, dbm: DatabaseManager): Promise<vscode.ReferenceProvider> {
  let fileCache = new CachedOperation<FullLocationLink[]>(async (uriString: string) => {
    const uri = decodeSourceArchiveUri(vscode.Uri.parse(uriString));
    const sourceArchiveUri = vscode.Uri.file(uri.sourceArchiveZipPath).with({ scheme: zipArchiveScheme });

    const db = dbm.findDatabaseItemBySourceArchive(sourceArchiveUri);
    if (db) {
      const qlpack = await qlpackOfDatabase(cli, db);
      if (qlpack === undefined) {
        throw new Error("Can't infer qlpack from database source archive");
      }
      const links: FullLocationLink[] = []
      for (const query of await resolveQueries(cli, qlpack, KeyType.ReferenceQuery)) {
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
          links.push(...await getLinksFromResults(results, cli, db, (_src, dest) => dest === uriString));
        }
      }
      return links;
    } else {
      return [];
    }
  })

  return {
    async provideReferences(document: vscode.TextDocument, position: vscode.Position, _context: vscode.ReferenceContext, _token: vscode.CancellationToken): Promise<vscode.Location[]> {
      const fileLinks = await fileCache.get(document.uri.toString());
      let locLinks: vscode.Location[] = [];
      for (const link of fileLinks) {
        if (link.targetRange!.contains(position)) {
          locLinks.push({ range: link.originSelectionRange!, uri: link.originUri });
        }
      }
      return locLinks;
    }

  };
}

interface FileRange {
  file: vscode.Uri,
  range: vscode.Range
}

async function getLinksFromResults(results: QueryWithResults, cli: CodeQLCliServer, db: DatabaseItem, filter: (srcFile: string, destFile: string) => boolean): Promise<FullLocationLink[]> {
  const localLinks: FullLocationLink[] = [];
  const bqrsPath = results.query.resultsPaths.resultsPath;
  const info = await cli.bqrsInfo(bqrsPath);
  const selectInfo = getResultSetSchema(SELECT_QUERY_NAME, info);
  if (selectInfo && selectInfo.columns.length == 3
    && selectInfo.columns[0].kind == "e"
    && selectInfo.columns[1].kind == "e"
    && selectInfo.columns[2].kind == "s") {
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

const CACHE_SIZE = 100;
class CachedOperation<U> {
  private readonly operation: (t: string) => Promise<U>;
  private readonly cached: Map<string, U>;
  private readonly lru: string[];
  private readonly inProgressCallbacks: Map<string, [(u: U) => void, (reason?: any) => void][]>;

  constructor(operation: (t: string) => Promise<U>) {
    this.operation = operation;
    this.lru = [];
    this.inProgressCallbacks = new Map<string, [(u: U) => void, (reason?: any) => void][]>();
    this.cached = new Map<string, U>();
  }

  async get(t: string): Promise<U> {
    // Try and retrieve from the cache
    const fromCache = this.cached.get(t);
    if (fromCache !== undefined) {
      // Move to end of lru list
      this.lru.push(this.lru.splice(this.lru.findIndex(v => v === t), 1)[0])
      return fromCache;
    }
    // Otherwise check if in progress
    const inProgressCallback = this.inProgressCallbacks.get(t);
    if (inProgressCallback !== undefined) {
      // If so wait for it to resolve
      return await new Promise((resolve, reject) => {
        inProgressCallback.push([resolve, reject]);
      });
    }

    // Otherwise compute the new value, but leave a callback to allow sharing work
    const callbacks: [(u: U) => void, (reason?: any) => void][] = [];
    this.inProgressCallbacks.set(t, callbacks);
    try {
      const result = await this.operation(t);
      callbacks.forEach(f => f[0](result));
      this.inProgressCallbacks.delete(t);
      if (this.lru.length > CACHE_SIZE) {
        const toRemove = this.lru.shift()!;
        this.cached.delete(toRemove);
      }
      this.lru.push(t);
      this.cached.set(t, result);
      return result;
    } catch (e) {
      // Rethrow error on all callbacks
      callbacks.forEach(f => f[1](e));
      throw e;
    } finally {
      this.inProgressCallbacks.delete(t);
    }
  }
}
