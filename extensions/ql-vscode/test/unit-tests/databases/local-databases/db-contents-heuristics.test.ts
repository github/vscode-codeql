import type { DirResult } from "tmp";
import { dirSync } from "tmp";
import { join } from "path";
import { mkdirSync, writeFileSync } from "fs-extra";
import {
  isLikelyDatabaseRoot,
  isLikelyDbLanguageFolder,
} from "../../../../src/databases/local-databases/db-contents-heuristics";

describe("isLikelyDatabaseRoot", () => {
  let dir: DirResult;
  beforeEach(() => {
    dir = dirSync({
      unsafeCleanup: true,
    });
  });

  afterEach(() => {
    dir.removeCallback();
  });

  it("should likely be a database root: codeql-database.yml", async () => {
    const dbFolder = join(dir.name, "db");
    mkdirSync(dbFolder);
    mkdirSync(join(dbFolder, "db-python"));
    writeFileSync(join(dbFolder, "codeql-database.yml"), "", "utf8");

    expect(await isLikelyDatabaseRoot(dbFolder)).toBe(true);
  });

  it("should likely be a database root: .dbinfo", async () => {
    const dbFolder = join(dir.name, "db");
    mkdirSync(dbFolder);
    mkdirSync(join(dbFolder, "db-python"));
    writeFileSync(join(dbFolder, ".dbinfo"), "", "utf8");

    expect(await isLikelyDatabaseRoot(dbFolder)).toBe(true);
  });

  it("should likely NOT be a database root: empty dir", async () => {
    const dbFolder = join(dir.name, "db");
    mkdirSync(dbFolder);
    mkdirSync(join(dbFolder, "db-python"));

    expect(await isLikelyDatabaseRoot(dbFolder)).toBe(false);
  });

  it("should likely NOT be a database root: no db language folder", async () => {
    const dbFolder = join(dir.name, "db");
    mkdirSync(dbFolder);
    writeFileSync(join(dbFolder, ".dbinfo"), "", "utf8");

    expect(await isLikelyDatabaseRoot(dbFolder)).toBe(false);
  });
});

describe("isLikelyDbLanguageFolder", () => {
  let dir: DirResult;
  beforeEach(() => {
    dir = dirSync({
      unsafeCleanup: true,
    });
  });

  afterEach(() => {
    dir.removeCallback();
  });

  it("should find likely db language folder", async () => {
    const dbFolder = join(dir.name, "db-python");
    mkdirSync(dbFolder);
    mkdirSync(join(dbFolder, "db-python"));
    writeFileSync(join(dbFolder, "codeql-database.yml"), "", "utf8");

    // not a db folder since there is a db-python folder inside this one
    expect(await isLikelyDbLanguageFolder(dbFolder)).toBe(false);

    const nestedDbPythonFolder = join(dbFolder, "db-python");
    expect(await isLikelyDbLanguageFolder(nestedDbPythonFolder)).toBe(true);
  });
});
