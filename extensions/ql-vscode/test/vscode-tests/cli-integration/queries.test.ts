import { CancellationToken, commands, ExtensionContext, Uri } from "vscode";
import { join, dirname } from "path";
import {
  pathExistsSync,
  readFileSync,
  mkdirpSync,
  writeFileSync,
  unlinkSync,
} from "fs-extra";
import { load, dump } from "js-yaml";

import { DatabaseItem, DatabaseManager } from "../../../src/local-databases";
import {
  cleanDatabases,
  dbLoc,
  getActivatedExtension,
  storagePath,
} from "../global.helper";
import { importArchiveDatabase } from "../../../src/databaseFetcher";
import { CliVersionConstraint, CodeQLCliServer } from "../../../src/cli";
import { describeWithCodeQL } from "../cli";
import { tmpDir } from "../../../src/helpers";
import { createInitialQueryInfo } from "../../../src/run-queries-shared";
import { QueryRunner } from "../../../src/queryRunner";
import { CompletedQueryInfo } from "../../../src/query-results";
import { SELECT_QUERY_NAME } from "../../../src/contextual/locationFinder";
import { createMockCommandManager } from "../../__mocks__/commandsMock";

jest.setTimeout(20_000);

/**
 * Integration tests for queries
 */
describeWithCodeQL()("Queries", () => {
  let dbItem: DatabaseItem;
  let databaseManager: DatabaseManager;
  let cli: CodeQLCliServer;
  let qs: QueryRunner;
  const progress = jest.fn();
  let token: CancellationToken;
  let ctx: ExtensionContext;

  let qlpackFile: string;
  let qlpackLockFile: string;
  let oldQlpackLockFile: string; // codeql v2.6.3 and earlier
  let qlFile: string;

  beforeEach(async () => {
    const extension = await getActivatedExtension();
    if ("databaseManager" in extension) {
      databaseManager = extension.databaseManager;
      cli = extension.cliServer;
      qs = extension.qs;
      cli.quiet = true;
      ctx = extension.ctx;
      qlpackFile = `${ctx.storageUri?.fsPath}/quick-queries/qlpack.yml`;
      qlpackLockFile = `${ctx.storageUri?.fsPath}/quick-queries/codeql-pack.lock.yml`;
      oldQlpackLockFile = `${ctx.storageUri?.fsPath}/quick-queries/qlpack.lock.yml`;
      qlFile = `${ctx.storageUri?.fsPath}/quick-queries/quick-query.ql`;
    } else {
      throw new Error(
        "Extension not initialized. Make sure cli is downloaded and installed properly.",
      );
    }

    // Ensure we are starting from a clean slate.
    safeDel(qlFile);
    safeDel(qlpackFile);

    token = {} as CancellationToken;

    // Add a database, but make sure the database manager is empty first
    await cleanDatabases(databaseManager);
    const uri = Uri.file(dbLoc);
    const maybeDbItem = await importArchiveDatabase(
      createMockCommandManager(),
      uri.toString(true),
      databaseManager,
      storagePath,
      progress,
      token,
      cli,
    );

    if (!maybeDbItem) {
      throw new Error("Could not import database");
    }
    dbItem = maybeDbItem;
  });

  afterEach(async () => {
    safeDel(qlpackFile);
    safeDel(qlFile);
    await cleanDatabases(databaseManager);
  });

  describe("extension packs", () => {
    const queryUsingExtensionPath = join(
      __dirname,
      "../..",
      "data-extensions",
      "pack-using-extensions",
      "query.ql",
    );

    it("should run a query that has an extension without looking for extensions in the workspace", async () => {
      if (!(await supportsExtensionPacks())) {
        console.log(
          `Skipping test because it is only supported for CodeQL CLI versions >= ${CliVersionConstraint.CLI_VERSION_WITH_QLPACKS_KIND}`,
        );
        return;
      }

      await cli.setUseExtensionPacks(false);
      const parsedResults = await runQueryWithExtensions();
      expect(parsedResults).toEqual([1]);
    });

    it("should run a query that has an extension and look for extensions in the workspace", async () => {
      if (!(await supportsExtensionPacks())) {
        return;
      }

      await cli.setUseExtensionPacks(true);
      const parsedResults = await runQueryWithExtensions();
      expect(parsedResults).toEqual([1, 2, 3, 4]);
    });

    async function supportsExtensionPacks(): Promise<boolean> {
      if (await qs.cliServer.cliConstraints.supportsQlpacksKind()) {
        return true;
      }
      console.log(
        `Skipping test because it is only supported for CodeQL CLI versions >= ${CliVersionConstraint.CLI_VERSION_WITH_QLPACKS_KIND}`,
      );
      return false;
    }

    async function runQueryWithExtensions() {
      const result = new CompletedQueryInfo(
        await qs.compileAndRunQueryAgainstDatabase(
          dbItem,
          await mockInitialQueryInfo(queryUsingExtensionPath),
          join(tmpDir.name, "mock-storage-path"),
          progress,
          token,
        ),
      );

      // Check that query was successful
      expect(result.successful).toBe(true);

      // Load query results
      const chunk = await qs.cliServer.bqrsDecode(
        result.getResultsPath(SELECT_QUERY_NAME, true),
        SELECT_QUERY_NAME,
        {
          // there should only be one result
          offset: 0,
          pageSize: 10,
        },
      );

      // Extract the results as an array.
      return chunk.tuples.map((t) => t[0]);
    }
  });

  it("should run a query", async () => {
    const queryPath = join(__dirname, "data", "simple-query.ql");
    const result = qs.compileAndRunQueryAgainstDatabase(
      dbItem,
      await mockInitialQueryInfo(queryPath),
      join(tmpDir.name, "mock-storage-path"),
      progress,
      token,
    );

    // just check that the query was successful
    expect((await result).successful).toBe(true);
  });

  // Asserts a fix for bug https://github.com/github/vscode-codeql/issues/733
  it("should restart the database and run a query", async () => {
    await commands.executeCommand("codeQL.restartQueryServer");
    const queryPath = join(__dirname, "data", "simple-query.ql");
    const result = await qs.compileAndRunQueryAgainstDatabase(
      dbItem,
      await mockInitialQueryInfo(queryPath),
      join(tmpDir.name, "mock-storage-path"),
      progress,
      token,
    );

    expect(result.successful).toBe(true);
  });

  it("should create a quick query", async () => {
    await commands.executeCommand("codeQL.quickQuery");

    // should have created the quick query file and query pack file
    expect(pathExistsSync(qlFile)).toBe(true);
    expect(pathExistsSync(qlpackFile)).toBe(true);

    const qlpackContents: any = await load(readFileSync(qlpackFile, "utf8"));
    // Should have chosen the js libraries
    expect(qlpackContents.dependencies["codeql/javascript-all"]).toBe("*");

    // Should also have a codeql-pack.lock.yml file
    const packFileToUse = pathExistsSync(qlpackLockFile)
      ? qlpackLockFile
      : oldQlpackLockFile;
    const qlpackLock: any = await load(readFileSync(packFileToUse, "utf8"));
    expect(!!qlpackLock.dependencies["codeql/javascript-all"].version).toBe(
      true,
    );
  });

  it("should avoid creating a quick query", async () => {
    mkdirpSync(dirname(qlpackFile));
    writeFileSync(
      qlpackFile,
      dump({
        name: "quick-query",
        version: "1.0.0",
        dependencies: {
          "codeql/javascript-all": "*",
        },
      }),
    );
    writeFileSync(qlFile, "xxx");
    await commands.executeCommand("codeQL.quickQuery");

    // should not have created the quick query file because database schema hasn't changed
    expect(readFileSync(qlFile, "utf8")).toBe("xxx");
  });

  function safeDel(file: string) {
    try {
      unlinkSync(file);
    } catch (e) {
      // ignore
    }
  }

  async function mockInitialQueryInfo(queryPath: string) {
    return await createInitialQueryInfo(
      Uri.file(queryPath),
      {
        name: dbItem.name,
        databaseUri: dbItem.databaseUri.toString(),
      },
      false,
    );
  }
});
