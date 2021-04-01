import {
  CancellationToken,
  DefinitionProvider,
  Location,
  LocationLink,
  Position,
  ProgressLocation,
  ReferenceContext,
  ReferenceProvider,
  TextDocument,
  Uri
} from 'vscode';

import { decodeSourceArchiveUri, encodeArchiveBasePath, zipArchiveScheme } from '../archive-filesystem-provider';
import { CodeQLCliServer } from '../cli';
import { DatabaseManager } from '../databases';
import { CachedOperation } from '../helpers';
import { ProgressCallback, withProgress } from '../commandRunner';
import * as messages from '../pure/messages';
import { QueryServerClient } from '../queryserver-client';
import { compileAndRunQueryAgainstDatabase, QueryWithResults } from '../run-queries';
import AstBuilder from './astBuilder';
import {
  KeyType,
} from './keyType';
import { FullLocationLink, getLocationsForUriString, TEMPLATE_NAME } from './locationFinder';
import { qlpackOfDatabase, resolveQueries } from './queryResolver';
import { isCanary, NO_CACHE_AST_VIEWER } from '../config';

/**
 * Run templated CodeQL queries to find definitions and references in
 * source-language files. We may eventually want to find a way to
 * generalize this to other custom queries, e.g. showing dataflow to
 * or from a selected identifier.
 */

export class TemplateQueryDefinitionProvider implements DefinitionProvider {
  private cache: CachedOperation<LocationLink[]>;

  constructor(
    private cli: CodeQLCliServer,
    private qs: QueryServerClient,
    private dbm: DatabaseManager,
  ) {
    this.cache = new CachedOperation<LocationLink[]>(this.getDefinitions.bind(this));
  }

  async provideDefinition(document: TextDocument, position: Position, _token: CancellationToken): Promise<LocationLink[]> {
    const fileLinks = await this.cache.get(document.uri.toString());
    const locLinks: LocationLink[] = [];
    for (const link of fileLinks) {
      if (link.originSelectionRange!.contains(position)) {
        locLinks.push(link);
      }
    }
    return locLinks;
  }

  private async getDefinitions(uriString: string): Promise<LocationLink[]> {
    return withProgress({
      location: ProgressLocation.Notification,
      cancellable: true,
      title: 'Finding definitions'
    }, async (progress, token) => {
      return getLocationsForUriString(
        this.cli,
        this.qs,
        this.dbm,
        uriString,
        KeyType.DefinitionQuery,
        progress,
        token,
        (src, _dest) => src === uriString
      );
    });
  }
}

export class TemplateQueryReferenceProvider implements ReferenceProvider {
  private cache: CachedOperation<FullLocationLink[]>;

  constructor(
    private cli: CodeQLCliServer,
    private qs: QueryServerClient,
    private dbm: DatabaseManager,
  ) {
    this.cache = new CachedOperation<FullLocationLink[]>(this.getReferences.bind(this));
  }

  async provideReferences(
    document: TextDocument,
    position: Position,
    _context: ReferenceContext,
    _token: CancellationToken
  ): Promise<Location[]> {
    const fileLinks = await this.cache.get(document.uri.toString());
    const locLinks: Location[] = [];
    for (const link of fileLinks) {
      if (link.targetRange!.contains(position)) {
        locLinks.push({ range: link.originSelectionRange!, uri: link.originUri });
      }
    }
    return locLinks;
  }

  private async getReferences(uriString: string): Promise<FullLocationLink[]> {
    return withProgress({
      location: ProgressLocation.Notification,
      cancellable: true,
      title: 'Finding references'
    }, async (progress, token) => {
      return getLocationsForUriString(
        this.cli,
        this.qs,
        this.dbm,
        uriString,
        KeyType.DefinitionQuery,
        progress,
        token,
        (src, _dest) => src === uriString
      );
    });
  }
}

export class TemplatePrintAstProvider {
  private cache: CachedOperation<QueryWithResults>;

  constructor(
    private cli: CodeQLCliServer,
    private qs: QueryServerClient,
    private dbm: DatabaseManager,
  ) {
    this.cache = new CachedOperation<QueryWithResults>(this.getAst.bind(this));
  }

  async provideAst(
    progress: ProgressCallback,
    token: CancellationToken,
    document?: TextDocument
  ): Promise<AstBuilder | undefined> {
    if (!document) {
      throw new Error('Cannot view the AST. Please select a valid source file inside a CodeQL database.');
    }
    const queryResults = this.shouldCache()
      ? await this.cache.get(document.uri.toString(), progress, token)
      : await this.getAst(document.uri.toString(), progress, token);

    return new AstBuilder(
      queryResults, this.cli,
      this.dbm.findDatabaseItem(Uri.parse(queryResults.database.databaseUri!, true))!,
      document.fileName
    );
  }

  private shouldCache() {
    return !(isCanary() && NO_CACHE_AST_VIEWER.getValue<boolean>());
  }

  private async getAst(
    uriString: string,
    progress: ProgressCallback,
    token: CancellationToken
  ): Promise<QueryWithResults> {
    const uri = Uri.parse(uriString, true);
    if (uri.scheme !== zipArchiveScheme) {
      throw new Error('Cannot view the AST. Please select a valid source file inside a CodeQL database.');
    }

    const zippedArchive = decodeSourceArchiveUri(uri);
    const sourceArchiveUri = encodeArchiveBasePath(zippedArchive.sourceArchiveZipPath);
    const db = this.dbm.findDatabaseItemBySourceArchive(sourceArchiveUri);

    if (!db) {
      throw new Error('Can\'t infer database from the provided source.');
    }

    const qlpack = await qlpackOfDatabase(this.cli, db);
    const queries = await resolveQueries(this.cli, qlpack, KeyType.PrintAstQuery);
    if (queries.length > 1) {
      throw new Error('Found multiple Print AST queries. Can\'t continue');
    }
    if (queries.length === 0) {
      throw new Error('Did not find any Print AST queries. Can\'t continue');
    }

    const query = queries[0];
    const templates: messages.TemplateDefinitions = {
      [TEMPLATE_NAME]: {
        values: {
          tuples: [[{
            stringValue: zippedArchive.pathWithinSourceArchive
          }]]
        }
      }
    };

    return await compileAndRunQueryAgainstDatabase(
      this.cli,
      this.qs,
      db,
      false,
      Uri.file(query),
      progress,
      token,
      templates
    );
  }
}
