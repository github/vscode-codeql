import {
  CancellationToken,
  DefinitionProvider,
  Location,
  LocationLink,
  Position,
  ReferenceContext,
  ReferenceProvider,
  TextDocument,
  Uri,
} from "vscode";

import {
  decodeSourceArchiveUri,
  encodeArchiveBasePath,
  zipArchiveScheme,
} from "../../common/vscode/archive-filesystem-provider";
import { CodeQLCliServer } from "../../codeql-cli/cli";
import { DatabaseManager } from "../../databases/local-databases";
import { CachedOperation } from "./cached-operation";
import { ProgressCallback, withProgress } from "../../common/vscode/progress";
import { KeyType } from "./key-type";
import {
  FullLocationLink,
  getLocationsForUriString,
  SELECTED_SOURCE_FILE,
  SELECTED_SOURCE_LINE,
  SELECTED_SOURCE_COLUMN,
} from "./location-finder";
import { resolveQueries, runContextualQuery } from "./query-resolver";
import {
  isCanary,
  NO_CACHE_AST_VIEWER,
  NO_CACHE_CONTEXTUAL_QUERIES,
} from "../../config";
import { CoreCompletedQuery, QueryRunner } from "../../query-server";
import { AstBuilder } from "../ast-viewer/ast-builder";
import { qlpackOfDatabase } from "../../local-queries";

/**
 * Runs templated CodeQL queries to find definitions in
 * source-language files. We may eventually want to find a way to
 * generalize this to other custom queries, e.g. showing dataflow to
 * or from a selected identifier.
 */
export class TemplateQueryDefinitionProvider implements DefinitionProvider {
  private cache: CachedOperation<LocationLink[]>;

  constructor(
    private cli: CodeQLCliServer,
    private qs: QueryRunner,
    private dbm: DatabaseManager,
    private queryStorageDir: string,
  ) {
    this.cache = new CachedOperation<LocationLink[]>(
      this.getDefinitions.bind(this),
    );
  }

  async provideDefinition(
    document: TextDocument,
    position: Position,
    _token: CancellationToken,
  ): Promise<LocationLink[]> {
    const fileLinks = this.shouldUseCache()
      ? await this.cache.get(document.uri.toString())
      : await this.getDefinitions(document.uri.toString());

    const locLinks: LocationLink[] = [];
    for (const link of fileLinks) {
      if (link.originSelectionRange!.contains(position)) {
        locLinks.push(link);
      }
    }
    return locLinks;
  }

  private shouldUseCache() {
    return !(isCanary() && NO_CACHE_CONTEXTUAL_QUERIES.getValue<boolean>());
  }

  private async getDefinitions(uriString: string): Promise<LocationLink[]> {
    return withProgress(
      async (progress, token) => {
        return getLocationsForUriString(
          this.cli,
          this.qs,
          this.dbm,
          uriString,
          KeyType.DefinitionQuery,
          this.queryStorageDir,
          progress,
          token,
          (src, _dest) => src === uriString,
        );
      },
      {
        cancellable: true,
        title: "Finding definitions",
      },
    );
  }
}

/**
 * Runs templated CodeQL queries to find references in
 * source-language files. We may eventually want to find a way to
 * generalize this to other custom queries, e.g. showing dataflow to
 * or from a selected identifier.
 */
export class TemplateQueryReferenceProvider implements ReferenceProvider {
  private cache: CachedOperation<FullLocationLink[]>;

  constructor(
    private cli: CodeQLCliServer,
    private qs: QueryRunner,
    private dbm: DatabaseManager,
    private queryStorageDir: string,
  ) {
    this.cache = new CachedOperation<FullLocationLink[]>(
      this.getReferences.bind(this),
    );
  }

  async provideReferences(
    document: TextDocument,
    position: Position,
    _context: ReferenceContext,
    _token: CancellationToken,
  ): Promise<Location[]> {
    const fileLinks = this.shouldUseCache()
      ? await this.cache.get(document.uri.toString())
      : await this.getReferences(document.uri.toString());

    const locLinks: Location[] = [];
    for (const link of fileLinks) {
      if (link.targetRange!.contains(position)) {
        locLinks.push({
          range: link.originSelectionRange!,
          uri: link.originUri,
        });
      }
    }
    return locLinks;
  }

  private shouldUseCache() {
    return !(isCanary() && NO_CACHE_CONTEXTUAL_QUERIES.getValue<boolean>());
  }

  private async getReferences(uriString: string): Promise<FullLocationLink[]> {
    return withProgress(
      async (progress, token) => {
        return getLocationsForUriString(
          this.cli,
          this.qs,
          this.dbm,
          uriString,
          KeyType.DefinitionQuery,
          this.queryStorageDir,
          progress,
          token,
          (src, _dest) => src === uriString,
        );
      },
      {
        cancellable: true,
        title: "Finding references",
      },
    );
  }
}

/**
 * Run templated CodeQL queries to produce AST information for
 * source-language files.
 */
export class TemplatePrintAstProvider {
  private cache: CachedOperation<CoreCompletedQuery>;

  constructor(
    private cli: CodeQLCliServer,
    private qs: QueryRunner,
    private dbm: DatabaseManager,
    private queryStorageDir: string,
  ) {
    this.cache = new CachedOperation<CoreCompletedQuery>(
      this.getAst.bind(this),
    );
  }

  async provideAst(
    progress: ProgressCallback,
    token: CancellationToken,
    fileUri?: Uri,
  ): Promise<AstBuilder | undefined> {
    if (!fileUri) {
      throw new Error(
        "Cannot view the AST. Please select a valid source file inside a CodeQL database.",
      );
    }
    const completedQuery = this.shouldUseCache()
      ? await this.cache.get(fileUri.toString(), progress, token)
      : await this.getAst(fileUri.toString(), progress, token);

    return new AstBuilder(
      completedQuery.outputDir,
      this.cli,
      this.dbm.findDatabaseItem(Uri.file(completedQuery.dbPath))!,
      fileUri,
    );
  }

  private shouldUseCache() {
    return !(isCanary() && NO_CACHE_AST_VIEWER.getValue<boolean>());
  }

  private async getAst(
    uriString: string,
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<CoreCompletedQuery> {
    const uri = Uri.parse(uriString, true);
    if (uri.scheme !== zipArchiveScheme) {
      throw new Error(
        "Cannot view the AST. Please select a valid source file inside a CodeQL database.",
      );
    }

    const zippedArchive = decodeSourceArchiveUri(uri);
    const sourceArchiveUri = encodeArchiveBasePath(
      zippedArchive.sourceArchiveZipPath,
    );
    const db = this.dbm.findDatabaseItemBySourceArchive(sourceArchiveUri);

    if (!db) {
      throw new Error("Can't infer database from the provided source.");
    }

    const qlpacks = await qlpackOfDatabase(this.cli, db);
    const queries = await resolveQueries(
      this.cli,
      qlpacks,
      KeyType.PrintAstQuery,
    );
    if (queries.length > 1) {
      throw new Error("Found multiple Print AST queries. Can't continue");
    }
    if (queries.length === 0) {
      throw new Error("Did not find any Print AST queries. Can't continue");
    }

    const query = queries[0];
    const templates: Record<string, string> = {
      [SELECTED_SOURCE_FILE]: zippedArchive.pathWithinSourceArchive,
    };

    const results = await runContextualQuery(
      query,
      db,
      this.queryStorageDir,
      this.qs,
      this.cli,
      progress,
      token,
      templates,
    );
    return results;
  }
}

/**
 * Run templated CodeQL queries to produce CFG information for
 * source-language files.
 */
export class TemplatePrintCfgProvider {
  private cache: CachedOperation<[Uri, Record<string, string>] | undefined>;

  constructor(
    private cli: CodeQLCliServer,
    private dbm: DatabaseManager,
  ) {
    this.cache = new CachedOperation<[Uri, Record<string, string>] | undefined>(
      this.getCfgUri.bind(this),
    );
  }

  async provideCfgUri(
    document: TextDocument,
    line: number,
    character: number,
  ): Promise<[Uri, Record<string, string>] | undefined> {
    return this.shouldUseCache()
      ? await this.cache.get(
          `${document.uri.toString()}#${line}:${character}`,
          line,
          character,
        )
      : await this.getCfgUri(document.uri.toString(), line, character);
  }

  private shouldUseCache() {
    return !(isCanary() && NO_CACHE_AST_VIEWER.getValue<boolean>());
  }

  private async getCfgUri(
    uriString: string,
    line: number,
    character: number,
  ): Promise<[Uri, Record<string, string>]> {
    const uri = Uri.parse(uriString, true);
    if (uri.scheme !== zipArchiveScheme) {
      throw new Error(
        "CFG Viewing is only available for databases with zipped source archives.",
      );
    }

    const zippedArchive = decodeSourceArchiveUri(uri);
    const sourceArchiveUri = encodeArchiveBasePath(
      zippedArchive.sourceArchiveZipPath,
    );
    const db = this.dbm.findDatabaseItemBySourceArchive(sourceArchiveUri);

    if (!db) {
      throw new Error("Can't infer database from the provided source.");
    }

    const qlpack = await qlpackOfDatabase(this.cli, db);
    if (!qlpack) {
      throw new Error("Can't infer qlpack from database source archive.");
    }
    const queries = await resolveQueries(
      this.cli,
      qlpack,
      KeyType.PrintCfgQuery,
    );
    if (queries.length > 1) {
      throw new Error(
        `Found multiple Print CFG queries. Can't continue. Make sure there is exacly one query with the tag ${KeyType.PrintCfgQuery}`,
      );
    }
    if (queries.length === 0) {
      throw new Error(
        `Did not find any Print CFG queries. Can't continue. Make sure there is exacly one query with the tag ${KeyType.PrintCfgQuery}`,
      );
    }

    const queryUri = Uri.file(queries[0]);

    const templates: Record<string, string> = {
      [SELECTED_SOURCE_FILE]: zippedArchive.pathWithinSourceArchive,
      [SELECTED_SOURCE_LINE]: line.toString(),
      [SELECTED_SOURCE_COLUMN]: character.toString(),
    };

    return [queryUri, templates];
  }
}
