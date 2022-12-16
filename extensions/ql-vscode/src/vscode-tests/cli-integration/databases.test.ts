import { join } from "path";
import { extensions, CancellationToken, Uri, window } from "vscode";

import { CodeQLExtensionInterface } from "../../extension";
import { CodeQLCliServer } from "../../cli";
import { DatabaseManager } from "../../databases";
import {
  importArchiveDatabase,
  promptImportInternetDatabase,
} from "../../databaseFetcher";
import { cleanDatabases, dbLoc, DB_URL, storagePath } from "./global.helper";

jest.setTimeout(60_000);

/**
 * Run various integration tests for databases
 */
describe("Databases", () => {
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

    const extension = await extensions
      .getExtension<CodeQLExtensionInterface | Record<string, never>>(
        "GitHub.vscode-codeql",
      )!
      .activate();
    if ("databaseManager" in extension) {
      databaseManager = extension.databaseManager;
    } else {
      throw new Error(
        "Extension not initialized. Make sure cli is downloaded and installed properly.",
      );
    }

    await cleanDatabases(databaseManager);
  });

  afterEach(async () => {
    await cleanDatabases(databaseManager);
  });

  it("should add a database from a folder", async () => {
    const uri = Uri.file(dbLoc);
    let dbItem = await importArchiveDatabase(
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

  it("should add a database from a url", async () => {
    inputBoxStub.mockResolvedValue(DB_URL);

    let dbItem = await promptImportInternetDatabase(
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
