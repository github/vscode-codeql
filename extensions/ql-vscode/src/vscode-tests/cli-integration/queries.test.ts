import { fail } from "assert";
import {
  CancellationToken,
  commands,
  ExtensionContext,
  extensions,
  Uri,
} from "vscode";
import * as sinon from "sinon";
import * as path from "path";
import * as fs from "fs-extra";
import { expect } from "chai";
import * as yaml from "js-yaml";

import { DatabaseItem, DatabaseManager } from "../../databases";
import { CodeQLExtensionInterface } from "../../extension";
import { cleanDatabases, dbLoc, storagePath } from "./global.helper";
import { importArchiveDatabase } from "../../databaseFetcher";
import { CodeQLCliServer } from "../../cli";
import { skipIfNoCodeQL } from "../ensureCli";
import { tmpDir } from "../../helpers";
import { createInitialQueryInfo } from "../../run-queries-shared";
import { QueryRunner } from "../../queryRunner";

/**
 * Integration tests for queries
 */
describe("Queries", function () {
  this.timeout(20_000);

  before(function () {
    skipIfNoCodeQL(this);
  });

  let dbItem: DatabaseItem;
  let databaseManager: DatabaseManager;
  let cli: CodeQLCliServer;
  let qs: QueryRunner;
  let sandbox: sinon.SinonSandbox;
  let progress: sinon.SinonSpy;
  let token: CancellationToken;
  let ctx: ExtensionContext;

  let qlpackFile: string;
  let qlpackLockFile: string;
  let oldQlpackLockFile: string; // codeql v2.6.3 and earlier
  let qlFile: string;

  beforeEach(async function () {
    this.timeout(20_000);

    sandbox = sinon.createSandbox();

    try {
      const extension = await extensions
        .getExtension<CodeQLExtensionInterface | Record<string, never>>(
          "GitHub.vscode-codeql",
        )!
        .activate();
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

      progress = sandbox.spy();
      token = {} as CancellationToken;

      // Add a database, but make sure the database manager is empty first
      await cleanDatabases(databaseManager);
      const uri = Uri.file(dbLoc);
      const maybeDbItem = await importArchiveDatabase(
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
    } catch (e) {
      fail(e as Error);
    }
  });

  afterEach(async function () {
    this.timeout(20_000);
    try {
      sandbox.restore();
      safeDel(qlpackFile);
      safeDel(qlFile);
      await cleanDatabases(databaseManager);
    } catch (e) {
      fail(e as Error);
    }
  });

  it("should run a query", async () => {
    try {
      const queryPath = path.join(__dirname, "data", "simple-query.ql");
      const result = qs.compileAndRunQueryAgainstDatabase(
        dbItem,
        await mockInitialQueryInfo(queryPath),
        path.join(tmpDir.name, "mock-storage-path"),
        progress,
        token,
      );

      // just check that the query was successful
      expect((await result).successful).to.eq(true);
    } catch (e) {
      console.error("Test Failed");
      fail(e as Error);
    }
  });

  // Asserts a fix for bug https://github.com/github/vscode-codeql/issues/733
  it("should restart the database and run a query", async () => {
    try {
      await commands.executeCommand("codeQL.restartQueryServer");
      const queryPath = path.join(__dirname, "data", "simple-query.ql");
      const result = await qs.compileAndRunQueryAgainstDatabase(
        dbItem,
        await mockInitialQueryInfo(queryPath),
        path.join(tmpDir.name, "mock-storage-path"),
        progress,
        token,
      );

      expect(result.successful).to.eq(true);
    } catch (e) {
      console.error("Test Failed");
      fail(e as Error);
    }
  });

  it("should create a quick query", async () => {
    await commands.executeCommand("codeQL.quickQuery");

    // should have created the quick query file and query pack file
    expect(fs.pathExistsSync(qlFile)).to.be.true;
    expect(fs.pathExistsSync(qlpackFile)).to.be.true;

    const qlpackContents: any = await yaml.load(
      fs.readFileSync(qlpackFile, "utf8"),
    );
    // Should have chosen the js libraries
    expect(qlpackContents.dependencies["codeql/javascript-all"]).to.eq("*");

    // Should also have a codeql-pack.lock.yml file
    const packFileToUse = fs.pathExistsSync(qlpackLockFile)
      ? qlpackLockFile
      : oldQlpackLockFile;
    const qlpackLock: any = await yaml.load(
      fs.readFileSync(packFileToUse, "utf8"),
    );
    expect(!!qlpackLock.dependencies["codeql/javascript-all"].version).to.be
      .true;
  });

  it("should avoid creating a quick query", async () => {
    fs.mkdirpSync(path.dirname(qlpackFile));
    fs.writeFileSync(
      qlpackFile,
      yaml.dump({
        name: "quick-query",
        version: "1.0.0",
        dependencies: {
          "codeql/javascript-all": "*",
        },
      }),
    );
    fs.writeFileSync(qlFile, "xxx");
    await commands.executeCommand("codeQL.quickQuery");

    // should not have created the quick query file because database schema hasn't changed
    expect(fs.readFileSync(qlFile, "utf8")).to.eq("xxx");
  });

  function safeDel(file: string) {
    try {
      fs.unlinkSync(file);
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
