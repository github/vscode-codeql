import { CancellationTokenSource, EventEmitter, Position, Uri } from "vscode";
import type { TextDocument } from "vscode";
import { encodeSourceArchiveUri } from "../../../../../src/common/vscode/archive-filesystem-provider";
import type { CodeQLCliServer } from "../../../../../src/codeql-cli/cli";
import type {
  DatabaseChangedEvent,
  DatabaseItem,
  DatabaseManager,
} from "../../../../../src/databases/local-databases";
import { DatabaseEventKind } from "../../../../../src/databases/local-databases";
import {
  TemplatePrintAstProvider,
  TemplatePrintCfgProvider,
  TemplateQueryDefinitionProvider,
  TemplateQueryReferenceProvider,
} from "../../../../../src/language-support";
import * as queryResolver from "../../../../../src/language-support/contextual/query-resolver";
import * as locationFinder from "../../../../../src/language-support/contextual/location-finder";
import type {
  CoreCompletedQuery,
  QueryRunner,
} from "../../../../../src/query-server";
import { QueryResultType } from "../../../../../src/query-server/messages";
import { QueryOutputDir } from "../../../../../src/local-queries/query-output-dir";
import { mockDatabaseItem, mockedObject } from "../../../utils/mocking.helpers";

describe("template-provider", () => {
  let dbChangedEmitter: EventEmitter<DatabaseChangedEvent>;
  let mockDb: DatabaseItem;
  let mockDbm: DatabaseManager;
  let maybeReimportTestDatabase: jest.MockedFunction<
    typeof DatabaseManager.prototype.maybeReimportTestDatabase
  >;
  let mockCli: CodeQLCliServer;
  let mockQs: QueryRunner;
  let fileUri: Uri;

  beforeEach(() => {
    dbChangedEmitter = new EventEmitter<DatabaseChangedEvent>();
    mockDb = mockDatabaseItem({
      databaseUri: Uri.file("/path/to/db"),
    });
    maybeReimportTestDatabase = jest.fn().mockResolvedValue(undefined);
    mockDbm = mockedObject<DatabaseManager>({
      onDidChangeDatabaseItem: dbChangedEmitter.event,
      findDatabaseItemBySourceArchive: jest.fn().mockReturnValue(mockDb),
      findDatabaseItem: jest.fn().mockReturnValue(mockDb),
      maybeReimportTestDatabase,
    });
    mockCli = mockedObject<CodeQLCliServer>({});
    mockQs = mockedObject<QueryRunner>({});
    fileUri = encodeSourceArchiveUri({
      sourceArchiveZipPath: "/path/to/db/src.zip",
      pathWithinSourceArchive: "/src/test.cs",
    });
  });

  afterEach(() => {
    dbChangedEmitter.dispose();
  });

  describe("TemplatePrintAstProvider", () => {
    let runContextualQuerySpy: jest.SpiedFunction<
      typeof queryResolver.runContextualQuery
    >;

    beforeEach(() => {
      jest
        .spyOn(queryResolver, "resolveContextualQlPacksForDatabase")
        .mockResolvedValue({
          dbschemePack: "my-qlpack",
          dbschemePackIsLibraryPack: false,
        });
      jest
        .spyOn(queryResolver, "resolveContextualQueries")
        .mockResolvedValue(["/path/to/PrintAst.ql"]);
      runContextualQuerySpy = jest
        .spyOn(queryResolver, "runContextualQuery")
        .mockImplementation(async () =>
          mockedObject<CoreCompletedQuery>({
            outputDir: new QueryOutputDir("/path/to/output"),
            dbPath: "/path/to/db",
            results: new Map([
              [
                "/path/to/PrintAst.ql",
                {
                  resultType: QueryResultType.SUCCESS,
                  message: undefined,
                  outputBaseName: "results",
                  evaluationTime: 10,
                },
              ],
            ]),
          }),
        );
    });

    it("caches AST results and invalidates cache when database is removed", async () => {
      const provider = new TemplatePrintAstProvider(
        mockCli,
        mockQs,
        mockDbm,
        "/path/to/storage",
      );
      const progress = jest.fn();
      const token = new CancellationTokenSource().token;

      await provider.provideAst(progress, token, fileUri);
      expect(runContextualQuerySpy).toHaveBeenCalledTimes(1);
      expect(maybeReimportTestDatabase).not.toHaveBeenCalled();

      // Second call uses cache, but checks whether test database needs reimporting first
      await provider.provideAst(progress, token, fileUri);
      expect(maybeReimportTestDatabase).toHaveBeenCalledTimes(1);
      expect(maybeReimportTestDatabase).toHaveBeenCalledWith(
        mockDb.databaseUri,
      );
      expect(runContextualQuerySpy).toHaveBeenCalledTimes(1);

      // Simulate database removal (e.g. during test database reimport)
      dbChangedEmitter.fire({
        item: mockDb,
        kind: DatabaseEventKind.Remove,
        fullRefresh: true,
      });

      await provider.provideAst(progress, token, fileUri);
      expect(runContextualQuerySpy).toHaveBeenCalledTimes(2);
    });

    it("re-evaluates AST when maybeReimportTestDatabase reimports the database on a cached file", async () => {
      const provider = new TemplatePrintAstProvider(
        mockCli,
        mockQs,
        mockDbm,
        "/path/to/storage",
      );
      const progress = jest.fn();
      const token = new CancellationTokenSource().token;

      await provider.provideAst(progress, token, fileUri);
      expect(runContextualQuerySpy).toHaveBeenCalledTimes(1);

      // Next time maybeReimportTestDatabase is called, simulate reimporting the database
      maybeReimportTestDatabase.mockImplementationOnce(async () => {
        dbChangedEmitter.fire({
          item: mockDb,
          kind: DatabaseEventKind.Remove,
          fullRefresh: true,
        });
      });

      await provider.provideAst(progress, token, fileUri);
      expect(maybeReimportTestDatabase).toHaveBeenCalledTimes(1);
      expect(runContextualQuerySpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("TemplateQueryDefinitionProvider", () => {
    it("resets cache on database removal and checks for outdated test database on cache hit", async () => {
      const getLocationsSpy = jest
        .spyOn(locationFinder, "getLocationsForUriString")
        .mockResolvedValue([]);

      const provider = new TemplateQueryDefinitionProvider(
        mockCli,
        mockQs,
        mockDbm,
        "/path/to/storage",
      );
      const doc = mockedObject<TextDocument>({ uri: fileUri });
      const pos = new Position(0, 0);
      const token = new CancellationTokenSource().token;

      await provider.provideDefinition(doc, pos, token);
      expect(getLocationsSpy).toHaveBeenCalledTimes(1);
      expect(maybeReimportTestDatabase).not.toHaveBeenCalled();

      await provider.provideDefinition(doc, pos, token);
      expect(maybeReimportTestDatabase).toHaveBeenCalledTimes(1);
      expect(getLocationsSpy).toHaveBeenCalledTimes(1);

      dbChangedEmitter.fire({
        item: mockDb,
        kind: DatabaseEventKind.Remove,
        fullRefresh: true,
      });

      await provider.provideDefinition(doc, pos, token);
      expect(getLocationsSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("TemplateQueryReferenceProvider", () => {
    it("resets cache on database removal and checks for outdated test database on cache hit", async () => {
      const getLocationsSpy = jest
        .spyOn(locationFinder, "getLocationsForUriString")
        .mockResolvedValue([]);

      const provider = new TemplateQueryReferenceProvider(
        mockCli,
        mockQs,
        mockDbm,
        "/path/to/storage",
      );
      const doc = mockedObject<TextDocument>({ uri: fileUri });
      const pos = new Position(0, 0);
      const token = new CancellationTokenSource().token;

      await provider.provideReferences(
        doc,
        pos,
        { includeDeclaration: true },
        token,
      );
      expect(getLocationsSpy).toHaveBeenCalledTimes(1);
      expect(maybeReimportTestDatabase).not.toHaveBeenCalled();

      await provider.provideReferences(
        doc,
        pos,
        { includeDeclaration: true },
        token,
      );
      expect(maybeReimportTestDatabase).toHaveBeenCalledTimes(1);
      expect(getLocationsSpy).toHaveBeenCalledTimes(1);

      dbChangedEmitter.fire({
        item: mockDb,
        kind: DatabaseEventKind.Remove,
        fullRefresh: true,
      });

      await provider.provideReferences(
        doc,
        pos,
        { includeDeclaration: true },
        token,
      );
      expect(getLocationsSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("TemplatePrintCfgProvider", () => {
    it("resets cache on database removal", async () => {
      const resolveQlPacksSpy = jest
        .spyOn(queryResolver, "resolveContextualQlPacksForDatabase")
        .mockResolvedValue({
          dbschemePack: "my-qlpack",
          dbschemePackIsLibraryPack: false,
        });
      jest
        .spyOn(queryResolver, "resolveContextualQueries")
        .mockResolvedValue(["/path/to/PrintCfg.ql"]);

      const provider = new TemplatePrintCfgProvider(mockCli, mockDbm);
      const doc = mockedObject<TextDocument>({ uri: fileUri });

      await provider.provideCfgUri(doc, 1, 1);
      expect(resolveQlPacksSpy).toHaveBeenCalledTimes(1);

      await provider.provideCfgUri(doc, 1, 1);
      expect(resolveQlPacksSpy).toHaveBeenCalledTimes(1);

      dbChangedEmitter.fire({
        item: mockDb,
        kind: DatabaseEventKind.Remove,
        fullRefresh: true,
      });

      await provider.provideCfgUri(doc, 1, 1);
      expect(resolveQlPacksSpy).toHaveBeenCalledTimes(2);
    });
  });
});
