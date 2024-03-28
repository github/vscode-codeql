import { join } from "path";
import { Uri, window } from "vscode";

import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import type { DatabaseManager } from "../../../../src/databases/local-databases";
import { DatabaseFetcher } from "../../../../src/databases/database-fetcher";
import {
  cleanDatabases,
  dbLoc,
  DB_URL,
  getActivatedExtension,
  storagePath,
  testprojLoc,
} from "../../global.helper";
import { existsSync, remove, utimesSync } from "fs-extra";
import { createMockApp } from "../../../__mocks__/appMock";

/**
 * Run various integration tests for databases
 */
describe("database-fetcher", () => {
  let databaseManager: DatabaseManager;
  let inputBoxStub: jest.SpiedFunction<typeof window.showInputBox>;
  let cli: CodeQLCliServer;
  const progressCallback = jest.fn();

  beforeEach(async () => {
    inputBoxStub = jest
      .spyOn(window, "showInputBox")
      .mockResolvedValue(undefined);

    jest.spyOn(window, "showErrorMessage").mockResolvedValue(undefined);
    jest.spyOn(window, "showInformationMessage").mockResolvedValue(undefined);

    const extension = await getActivatedExtension();
    databaseManager = extension.databaseManager;
    cli = extension.cliServer;

    await cleanDatabases(databaseManager);
  });

  afterEach(async () => {
    await cleanDatabases(databaseManager);
    await remove(storagePath);
  });

  describe("importLocalDatabase", () => {
    it("should add a database from an archive", async () => {
      const uri = Uri.file(dbLoc);
      const databaseFetcher = new DatabaseFetcher(
        createMockApp(),
        databaseManager,
        storagePath,
        cli,
      );
      let dbItem = await databaseFetcher.importLocalDatabase(
        uri.toString(true),
        progressCallback,
      );
      expect(dbItem).toBe(databaseManager.currentDatabaseItem);
      expect(dbItem).toBe(databaseManager.databaseItems[0]);
      expect(dbItem).toBeDefined();
      dbItem = dbItem!;
      expect(dbItem.name).toBe("db");
      expect(dbItem.databaseUri.fsPath).toBe(join(storagePath, "db", "db"));
    });

    it("should import a testproj database", async () => {
      const databaseFetcher = new DatabaseFetcher(
        createMockApp(),
        databaseManager,
        storagePath,
        cli,
      );
      let dbItem = await databaseFetcher.importLocalDatabase(
        Uri.file(testprojLoc).toString(true),
        progressCallback,
      );
      expect(dbItem).toBe(databaseManager.currentDatabaseItem);
      expect(dbItem).toBe(databaseManager.databaseItems[0]);
      expect(dbItem).toBeDefined();
      dbItem = dbItem!;
      expect(dbItem.name).toBe("db");
      expect(dbItem.databaseUri.fsPath).toBe(join(storagePath, "db"));

      // Now that we have fetched it. Check for re-importing
      // Delete a file in the imported database and we can check if the file is recreated
      const srczip = join(dbItem.databaseUri.fsPath, "src.zip");
      await remove(srczip);

      // Attempt 1: re-import database should be a no-op since timestamp of imported database is newer
      await databaseManager.maybeReimportTestDatabase(dbItem.databaseUri);
      expect(existsSync(srczip)).toBeFalsy();

      // Attempt 3: re-import database should re-import the database after updating modified time
      utimesSync(
        join(testprojLoc, "codeql-database.yml"),
        new Date(),
        new Date(),
      );

      await databaseManager.maybeReimportTestDatabase(dbItem.databaseUri, true);
      expect(existsSync(srczip)).toBeTruthy();
    });
  });

  describe("promptImportInternetDatabase", () => {
    it("should add a database from a url", async () => {
      // Provide a database URL when prompted
      inputBoxStub.mockResolvedValue(DB_URL);

      const databaseFetcher = new DatabaseFetcher(
        createMockApp(),
        databaseManager,
        storagePath,
        cli,
      );
      let dbItem =
        await databaseFetcher.promptImportInternetDatabase(progressCallback);
      expect(dbItem).toBeDefined();
      dbItem = dbItem!;
      expect(dbItem.name).toBe("db");
      expect(dbItem.databaseUri.fsPath).toBe(
        join(storagePath, "simple-db", "db"),
      );
    });
  });
});
