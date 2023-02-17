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
  Uri,
} from "vscode";

import {
  decodeSourceArchiveUri,
  encodeArchiveBasePath,
  zipArchiveScheme,
} from "../archive-filesystem-provider";
import { CodeQLCliServer } from "../cli";
import { DatabaseManager } from "../local-databases";
import { CachedOperation } from "../helpers";
import { ProgressCallback, withProgress } from "../commandRunner";
import AstBuilder from "./astBuilder";
import { KeyType } from "./keyType";
import {
  FullLocationLink,
  getLocationsForUriString,
  TEMPLATE_NAME,
} from "./locationFinder";
import {
  qlpackOfDatabase,
  resolveQueries,
  runContextualQuery,
} from "./queryResolver";
import { isCanary, NO_CACHE_AST_VIEWER } from "../config";
import { QueryWithResults } from "../run-queries-shared";
import { QueryRunner } from "../queryRunner";

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
    return withProgress(
      {
        location: ProgressLocation.Notification,
        cancellable: true,
        title: "Finding definitions",
      },
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
    const fileLinks = await this.cache.get(document.uri.toString());
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

  private async getReferences(uriString: string): Promise<FullLocationLink[]> {
    return withProgress(
      {
        location: ProgressLocation.Notification,
        cancellable: true,
        title: "Finding references",
      },
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
    );
  }
}

type QueryWithDb = {
  query: QueryWithResults;
  dbUri: Uri;
};

/**
 * Run templated CodeQL queries to produce AST information for
 * source-language files.
 */
export class TemplatePrintAstProvider {
  private cache: CachedOperation<QueryWithDb>;

  constructor(
    private cli: CodeQLCliServer,
    private qs: QueryRunner,
    private dbm: DatabaseManager,
    private queryStorageDir: string,
  ) {
    this.cache = new CachedOperation<QueryWithDb>(this.getAst.bind(this));
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
    const { query, dbUri } = this.shouldCache()
      ? await this.cache.get(fileUri.toString(), progress, token)
      : await this.getAst(fileUri.toString(), progress, token);

    return new AstBuilder(
      query,
      this.cli,
      this.dbm.findDatabaseItem(dbUri)!,
      fileUri,
    );
  }

  private shouldCache() {
    return !(isCanary() && NO_CACHE_AST_VIEWER.getValue<boolean>());
  }

  private async getAst(
    uriString: string,
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<QueryWithDb> {
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
      [TEMPLATE_NAME]: zippedArchive.pathWithinSourceArchive,
    };

    const queryResult = await runContextualQuery(
      query,
      db,
      this.queryStorageDir,
      this.qs,
      this.cli,
      progress,
      token,
      templates,
    );
    return {
      query: queryResult,
      dbUri: db.databaseUri,
    };
  }
}

/**
 * Run templated CodeQL queries to produce CFG information for
 * source-language files.
 */
export class TemplatePrintCfgProvider {
  private cache: CachedOperation<[Uri, Record<string, string>] | undefined>;

  constructor(private cli: CodeQLCliServer, private dbm: DatabaseManager) {
    this.cache = new CachedOperation<[Uri, Record<string, string>] | undefined>(
      this.getCfgUri.bind(this),
    );
  }

  async provideCfgUri(
    document?: TextDocument,
  ): Promise<[Uri, Record<string, string>] | undefined> {
    if (!document) {
      return;
    }
    return await this.cache.get(document.uri.toString());
  }

  private async getCfgUri(
    uriString: string,
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
      [TEMPLATE_NAME]: zippedArchive.pathWithinSourceArchive,
    };

    return [queryUri, templates];
  }
}
