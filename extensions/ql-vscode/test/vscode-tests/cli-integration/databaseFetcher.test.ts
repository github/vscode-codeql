import { join } from "path";
import { CancellationToken, Uri, window } from "vscode";

import { CodeQLCliServer } from "../../../src/cli";
import { DatabaseManager } from "../../../src/local-databases";
import {
  importArchiveDatabase,
  promptImportInternetDatabase,
} from "../../../src/databaseFetcher";
import {
  cleanDatabases,
  dbLoc,
  DB_URL,
  getActivatedExtension,
  storagePath,
} from "../global.helper";
import { createMockCommandManager } from "../../__mocks__/commandsMock";

/**
 * Run various integration tests for databases
 */
describe("DatabaseFetcher", () => {
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

    await cleanDatabases(databaseManager);
  });

  afterEach(async () => {
    await cleanDatabases(databaseManager);
  });

  describe("importArchiveDatabase", () => {
    it("should add a database from a folder", async () => {
      const uri = Uri.file(dbLoc);
      let dbItem = await importArchiveDatabase(
        createMockCommandManager(),
        uri.toString(true),
        databaseManager,
        storagePath,
        progressCallback,
        {} as CancellationToken,
        cli,
      );
      expect(dbItem).toBe(databaseManager.currentDatabaseItem);
      expect(dbItem).toBe(databaseManager.databaseItems[0]);
      expect(dbItem).toBeDefined();
      dbItem = dbItem!;
      expect(dbItem.name).toBe("db");
      expect(dbItem.databaseUri.fsPath).toBe(join(storagePath, "db", "db"));
    });
  });

  describe("promptImportInternetDatabase", () => {
    it("should add a database from a url", async () => {
      // Provide a database URL when prompted
      inputBoxStub.mockResolvedValue(DB_URL);

      let dbItem = await promptImportInternetDatabase(
        createMockCommandManager(),
        databaseManager,
        storagePath,
        progressCallback,
        {} as CancellationToken,
        cli,
      );
      expect(dbItem).toBeDefined();
      dbItem = dbItem!;
      expect(dbItem.name).toBe("db");
      expect(dbItem.databaseUri.fsPath).toBe(
        join(storagePath, "simple-db", "db"),
      );
    });
  });
});
