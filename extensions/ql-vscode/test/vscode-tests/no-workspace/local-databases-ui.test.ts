import { dirSync, fileSync } from "tmp";
import { dirname, join } from "path";
import {
  mkdirs,
  createFile,
  mkdirsSync,
  createFileSync,
  pathExistsSync,
} from "fs-extra";
import { Uri } from "vscode";

import { DatabaseUI } from "../../../src/local-databases-ui";
import { testDisposeHandler } from "../test-dispose-handler";
import { createMockApp } from "../../__mocks__/appMock";
import { QueryLanguage } from "../../../src/common/query-language";

describe("local-databases-ui", () => {
  describe("fixDbUri", () => {
    const fixDbUri = (DatabaseUI.prototype as any).fixDbUri;
    it("should choose current directory direcory normally", async () => {
      const dir = dirSync().name;
      const uri = await fixDbUri(Uri.file(dir));
      expect(uri.toString()).toBe(Uri.file(dir).toString());
    });

    it("should choose parent direcory when file is selected", async () => {
      const file = fileSync().name;
      const uri = await fixDbUri(Uri.file(file));
      expect(uri.toString()).toBe(Uri.file(dirname(file)).toString());
    });

    it("should choose parent direcory when db-* is selected", async () => {
      const dir = dirSync().name;
      const dbDir = join(dir, "db-javascript");
      await mkdirs(dbDir);

      const uri = await fixDbUri(Uri.file(dbDir));
      expect(uri.toString()).toBe(Uri.file(dir).toString());
    });

    it("should choose parent's parent direcory when file selected is in db-*", async () => {
      const dir = dirSync().name;
      const dbDir = join(dir, "db-javascript");
      const file = join(dbDir, "nested");
      await mkdirs(dbDir);
      await createFile(file);

      const uri = await fixDbUri(Uri.file(file));
      expect(uri.toString()).toBe(Uri.file(dir).toString());
    });

    it("should handle a parent whose name is db-*", async () => {
      // fixes https://github.com/github/vscode-codeql/issues/482
      const dir = dirSync().name;
      const parentDir = join(dir, "db-hucairz");
      const dbDir = join(parentDir, "db-javascript");
      const file = join(dbDir, "nested");
      mkdirsSync(dbDir);
      createFileSync(file);

      const uri = await fixDbUri(Uri.file(file));
      expect(uri.toString()).toBe(Uri.file(parentDir).toString());
    });
  });

  it("should delete orphaned databases", async () => {
    const storageDir = dirSync().name;
    const db1 = createDatabase(storageDir, "db1-imported", QueryLanguage.Cpp);
    const db2 = createDatabase(
      storageDir,
      "db2-notimported",
      QueryLanguage.Cpp,
    );
    const db3 = createDatabase(storageDir, "db3-invalidlanguage", "hucairz");

    // these two should be deleted
    const db4 = createDatabase(
      storageDir,
      "db2-notimported-with-db-info",
      QueryLanguage.Cpp,
      ".dbinfo",
    );
    const db5 = createDatabase(
      storageDir,
      "db2-notimported-with-codeql-database.yml",
      QueryLanguage.Cpp,
      "codeql-database.yml",
    );

    const app = createMockApp({});
    const databaseUI = new DatabaseUI(
      app,
      {
        databaseItems: [{ databaseUri: Uri.file(db1) }],
        onDidChangeDatabaseItem: () => {
          /**/
        },
        onDidChangeCurrentDatabaseItem: () => {
          /**/
        },
      } as any,
      {} as any,
      storageDir,
      storageDir,
    );

    await databaseUI.handleRemoveOrphanedDatabases();

    expect(pathExistsSync(db1)).toBe(true);
    expect(pathExistsSync(db2)).toBe(true);
    expect(pathExistsSync(db3)).toBe(true);

    expect(pathExistsSync(db4)).toBe(false);
    expect(pathExistsSync(db5)).toBe(false);

    databaseUI.dispose(testDisposeHandler);
  });

  function createDatabase(
    storageDir: string,
    dbName: string,
    language: string,
    extraFile?: string,
  ) {
    const parentDir = join(storageDir, dbName);
    const dbDir = join(parentDir, `db-${language}`);
    mkdirsSync(dbDir);

    if (extraFile) {
      createFileSync(join(parentDir, extraFile));
    }

    return parentDir;
  }
});
