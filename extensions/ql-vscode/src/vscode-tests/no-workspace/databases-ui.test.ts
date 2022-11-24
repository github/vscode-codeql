import * as tmp from "tmp";
import * as path from "path";
import * as fs from "fs-extra";
import { Uri } from "vscode";

import { DatabaseUI } from "../../databases-ui";
import { testDisposeHandler } from "../test-dispose-handler";
import { Credentials } from "../../authentication";

describe("databases-ui", () => {
  describe("fixDbUri", () => {
    const fixDbUri = (DatabaseUI.prototype as any).fixDbUri;
    it("should choose current directory direcory normally", async () => {
      const dir = tmp.dirSync().name;
      const uri = await fixDbUri(Uri.file(dir));
      expect(uri.toString()).toBe(Uri.file(dir).toString());
    });

    it("should choose parent direcory when file is selected", async () => {
      const file = tmp.fileSync().name;
      const uri = await fixDbUri(Uri.file(file));
      expect(uri.toString()).toBe(Uri.file(path.dirname(file)).toString());
    });

    it("should choose parent direcory when db-* is selected", async () => {
      const dir = tmp.dirSync().name;
      const dbDir = path.join(dir, "db-javascript");
      await fs.mkdirs(dbDir);

      const uri = await fixDbUri(Uri.file(dbDir));
      expect(uri.toString()).toBe(Uri.file(dir).toString());
    });

    it("should choose parent's parent direcory when file selected is in db-*", async () => {
      const dir = tmp.dirSync().name;
      const dbDir = path.join(dir, "db-javascript");
      const file = path.join(dbDir, "nested");
      await fs.mkdirs(dbDir);
      await fs.createFile(file);

      const uri = await fixDbUri(Uri.file(file));
      expect(uri.toString()).toBe(Uri.file(dir).toString());
    });

    it("should handle a parent whose name is db-*", async () => {
      // fixes https://github.com/github/vscode-codeql/issues/482
      const dir = tmp.dirSync().name;
      const parentDir = path.join(dir, "db-hucairz");
      const dbDir = path.join(parentDir, "db-javascript");
      const file = path.join(dbDir, "nested");
      fs.mkdirsSync(dbDir);
      fs.createFileSync(file);

      const uri = await fixDbUri(Uri.file(file));
      expect(uri.toString()).toBe(Uri.file(parentDir).toString());
    });
  });

  it("should delete orphaned databases", async () => {
    const storageDir = tmp.dirSync().name;
    const db1 = createDatabase(storageDir, "db1-imported", "cpp");
    const db2 = createDatabase(storageDir, "db2-notimported", "cpp");
    const db3 = createDatabase(storageDir, "db3-invalidlanguage", "hucairz");

    // these two should be deleted
    const db4 = createDatabase(
      storageDir,
      "db2-notimported-with-db-info",
      "cpp",
      ".dbinfo",
    );
    const db5 = createDatabase(
      storageDir,
      "db2-notimported-with-codeql-database.yml",
      "cpp",
      "codeql-database.yml",
    );

    const databaseUI = new DatabaseUI(
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
      () => Promise.resolve({} as Credentials),
    );

    await databaseUI.handleRemoveOrphanedDatabases();

    expect(fs.pathExistsSync(db1)).toBe(true);
    expect(fs.pathExistsSync(db2)).toBe(true);
    expect(fs.pathExistsSync(db3)).toBe(true);

    expect(fs.pathExistsSync(db4)).toBe(false);
    expect(fs.pathExistsSync(db5)).toBe(false);

    databaseUI.dispose(testDisposeHandler);
  });

  function createDatabase(
    storageDir: string,
    dbName: string,
    language: string,
    extraFile?: string,
  ) {
    const parentDir = path.join(storageDir, dbName);
    const dbDir = path.join(parentDir, `db-${language}`);
    fs.mkdirsSync(dbDir);

    if (extraFile) {
      fs.createFileSync(path.join(parentDir, extraFile));
    }

    return parentDir;
  }
});
