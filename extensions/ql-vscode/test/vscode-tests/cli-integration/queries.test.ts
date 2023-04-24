import { CancellationToken, ExtensionContext, Range, Uri } from "vscode";
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
  ensureTestDatabase,
  getActivatedExtension,
} from "../global.helper";
import { CliVersionConstraint, CodeQLCliServer } from "../../../src/cli";
import { describeWithCodeQL } from "../cli";
import {
  CoreCompletedQuery,
  QueryRunner,
} from "../../../src/query-server/query-runner";
import { SELECT_QUERY_NAME } from "../../../src/language-support/contextual/location-finder";
import { LocalQueries } from "../../../src/local-queries";
import { QueryResultType } from "../../../src/pure/new-messages";
import { createVSCodeCommandManager } from "../../../src/common/vscode/commands";
import {
  AllCommands,
  AppCommandManager,
  QueryServerCommands,
} from "../../../src/common/commands";
import { ProgressCallback } from "../../../src/progress";
import { withDebugController } from "./debugger/debug-controller";

type DebugMode = "localQueries" | "debug";

async function compileAndRunQuery(
  mode: DebugMode,
  appCommands: AppCommandManager,
  localQueries: LocalQueries,
  quickEval: boolean,
  queryUri: Uri,
  progress: ProgressCallback,
  token: CancellationToken,
  databaseItem: DatabaseItem | undefined,
  range?: Range,
): Promise<CoreCompletedQuery> {
  switch (mode) {
    case "localQueries":
      return await localQueries.compileAndRunQueryInternal(
        quickEval,
        queryUri,
        progress,
        token,
        databaseItem,
        range,
      );

    case "debug":
      return await withDebugController(appCommands, async (controller) => {
        await controller.startDebugging(
          {
            query: queryUri.fsPath,
          },
          true,
        );
        await controller.expectLaunched();
        const succeeded = await controller.expectSucceeded();
        await controller.expectExited();
        await controller.expectTerminated();
        await controller.expectSessionClosed();

        return succeeded.results;
      });
  }
}

const MODES: DebugMode[] = ["localQueries", "debug"];

/**
 * Integration tests for queries
 */
describeWithCodeQL()("Queries", () => {
  let dbItem: DatabaseItem;
  let databaseManager: DatabaseManager;
  let cli: CodeQLCliServer;
  let qs: QueryRunner;
  let localQueries: LocalQueries;
  const progress = jest.fn();
  let token: CancellationToken;
  let ctx: ExtensionContext;
  const appCommandManager = createVSCodeCommandManager<AllCommands>();
  const queryServerCommandManager =
    createVSCodeCommandManager<QueryServerCommands>();

  let qlpackFile: string;
  let qlpackLockFile: string;
  let oldQlpackLockFile: string; // codeql v2.6.3 and earlier
  let qlFile: string;

  beforeEach(async () => {
    const extension = await getActivatedExtension();
    databaseManager = extension.databaseManager;
    cli = extension.cliServer;
    qs = extension.qs;
    localQueries = extension.localQueries;
    cli.quiet = true;
    ctx = extension.ctx;
    qlpackFile = `${ctx.storageUri?.fsPath}/quick-queries/qlpack.yml`;
    qlpackLockFile = `${ctx.storageUri?.fsPath}/quick-queries/codeql-pack.lock.yml`;
    oldQlpackLockFile = `${ctx.storageUri?.fsPath}/quick-queries/qlpack.lock.yml`;
    qlFile = `${ctx.storageUri?.fsPath}/quick-queries/quick-query.ql`;

    // Ensure we are starting from a clean slate.
    safeDel(qlFile);
    safeDel(qlpackFile);

    token = {
      onCancellationRequested: (_) => {
        void _;
      },
    } as CancellationToken;

    dbItem = await ensureTestDatabase(databaseManager, cli);
  });

  afterEach(async () => {
    safeDel(qlpackFile);
    safeDel(qlFile);
    await cleanDatabases(databaseManager);
  });

  describe.each(MODES)("extension packs (%s)", (mode) => {
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
      const result = await compileAndRunQuery(
        mode,
        appCommandManager,
        localQueries,
        false,
        Uri.file(queryUsingExtensionPath),
        progress,
        token,
        dbItem,
        undefined,
      );

      // Check that query was successful
      expect(result.resultType).toBe(QueryResultType.SUCCESS);

      // Load query results
      const chunk = await qs.cliServer.bqrsDecode(
        result.outputDir.bqrsPath,
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

  describe.each(MODES)("running queries (%s)", (mode) => {
    it("should run a query", async () => {
      const queryPath = join(__dirname, "data", "simple-query.ql");
      const result = await compileAndRunQuery(
        mode,
        appCommandManager,
        localQueries,
        false,
        Uri.file(queryPath),
        progress,
        token,
        dbItem,
        undefined,
      );

      // just check that the query was successful
      expect(result.resultType).toBe(QueryResultType.SUCCESS);
    });

    // Asserts a fix for bug https://github.com/github/vscode-codeql/issues/733
    it("should restart the database and run a query", async () => {
      await appCommandManager.execute("codeQL.restartQueryServer");
      const queryPath = join(__dirname, "data", "simple-query.ql");
      const result = await compileAndRunQuery(
        mode,
        appCommandManager,
        localQueries,
        false,
        Uri.file(queryPath),
        progress,
        token,
        dbItem,
        undefined,
      );

      expect(result.resultType).toBe(QueryResultType.SUCCESS);
    });
  });

  describe("quick query", () => {
    it("should create a quick query", async () => {
      await queryServerCommandManager.execute("codeQL.quickQuery");

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
      await queryServerCommandManager.execute("codeQL.quickQuery");

      // should not have created the quick query file because database schema hasn't changed
      expect(readFileSync(qlFile, "utf8")).toBe("xxx");
    });
  });

  function safeDel(file: string) {
    try {
      unlinkSync(file);
    } catch (e) {
      // ignore
    }
  }
});
