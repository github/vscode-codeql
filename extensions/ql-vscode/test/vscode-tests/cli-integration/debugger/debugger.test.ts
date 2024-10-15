import type { TextEditor } from "vscode";
import { Position, Selection, Uri, window, workspace } from "vscode";

import type { DatabaseManager } from "../../../../src/databases/local-databases";
import {
  cleanDatabases,
  ensureTestDatabase,
  getActivatedExtension,
} from "../../global.helper";
import { describeWithCodeQL } from "../../cli";
import { withDebugController } from "./debug-controller";
import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import type { QueryOutputDir } from "../../../../src/local-queries/query-output-dir";
import { createVSCodeCommandManager } from "../../../../src/common/vscode/commands";
import type { AllCommands } from "../../../../src/common/commands";
import { getDataFolderFilePath } from "../utils";

async function selectForQuickEval(
  path: string,
  line: number,
  column: number,
  endLine: number,
  endColumn: number,
): Promise<TextEditor> {
  const document = await workspace.openTextDocument(path);
  const editor = await window.showTextDocument(document);
  editor.selection = new Selection(line, column, endLine, endColumn);

  return editor;
}

async function getResultCount(
  outputDir: QueryOutputDir,
  cli: CodeQLCliServer,
): Promise<number> {
  const info = await cli.bqrsInfo(outputDir.bqrsPath, 100);
  const resultSet = info["result-sets"][0];
  return resultSet.rows;
}

/**
 * Integration tests for the query debugger
 */
describeWithCodeQL()("Debugger", () => {
  let databaseManager: DatabaseManager;
  let cli: CodeQLCliServer;
  const appCommands = createVSCodeCommandManager<AllCommands>();
  const simpleQueryPath = getDataFolderFilePath("debugger/simple-query.ql");
  const quickEvalQueryPath = getDataFolderFilePath(
    "debugger/QuickEvalQuery.ql",
  );
  const quickEvalBigIntQueryPath = getDataFolderFilePath(
    "debugger/QuickEvalBigIntQuery.ql",
  );
  const quickEvalLibPath = getDataFolderFilePath("debugger/QuickEvalLib.qll");

  beforeEach(async () => {
    const extension = await getActivatedExtension();
    databaseManager = extension.databaseManager;
    cli = extension.cliServer;
    cli.quiet = true;

    await ensureTestDatabase(databaseManager, cli);
  });

  afterEach(async () => {
    await cleanDatabases(databaseManager);
  });

  it("should debug a query and keep the session active", async () => {
    await withDebugController(appCommands, async (controller) => {
      await controller.debugQuery(Uri.file(simpleQueryPath));
      await controller.expectLaunched();
      await controller.expectSucceeded();
      await controller.expectStopped();
    });
  });

  it("should run a query and then stop debugging", async () => {
    await withDebugController(appCommands, async (controller) => {
      await controller.startDebugging(
        {
          query: simpleQueryPath,
        },
        true,
      );
      await controller.expectLaunched();
      await controller.expectSucceeded();
      await controller.expectExited();
      await controller.expectTerminated();
      await controller.expectSessionClosed();
    });
  });

  it("should run a quick evaluation", async () => {
    await withDebugController(appCommands, async (controller) => {
      await selectForQuickEval(quickEvalQueryPath, 18, 5, 18, 22);

      // Don't specify a query path, so we'll default to the active document ("QuickEvalQuery.ql")
      await controller.startDebuggingSelection({});
      await controller.expectLaunched();
      const result = await controller.expectSucceeded();
      expect(result.started.quickEvalContext).toBeDefined();
      expect(result.started.quickEvalContext!.quickEvalText).toBe(
        "InterestingNumber",
      );
      expect(result.results.queryTarget.quickEvalPosition).toBeDefined();
      expect(await getResultCount(result.results.outputDir, cli)).toBe(8);
      await controller.expectStopped();
    });
  });

  it("should run a quick evaluation on a library without any query context", async () => {
    await withDebugController(appCommands, async (controller) => {
      await selectForQuickEval(quickEvalLibPath, 4, 15, 4, 32);

      // Don't specify a query path, so we'll default to the active document ("QuickEvalLib.qll")
      await controller.startDebuggingSelection({});
      await controller.expectLaunched();
      const result = await controller.expectSucceeded();
      expect(result.started.quickEvalContext).toBeDefined();
      expect(result.started.quickEvalContext!.quickEvalText).toBe(
        "InterestingNumber",
      );
      expect(result.results.queryTarget.quickEvalPosition).toBeDefined();
      expect(await getResultCount(result.results.outputDir, cli)).toBe(0);
      await controller.expectStopped();
    });
  });

  it("should run a quick evaluation on a library in the context of a specific query", async () => {
    await withDebugController(appCommands, async (controller) => {
      await selectForQuickEval(quickEvalLibPath, 4, 15, 4, 32);

      await controller.startDebuggingSelection({
        query: quickEvalQueryPath, // The query context. This query extends the abstract class.
      });
      await controller.expectLaunched();
      const result = await controller.expectSucceeded();
      expect(result.started.quickEvalContext).toBeDefined();
      expect(result.started.quickEvalContext!.quickEvalText).toBe(
        "InterestingNumber",
      );
      expect(result.results.queryTarget.quickEvalPosition).toBeDefined();
      expect(await getResultCount(result.results.outputDir, cli)).toBe(8);
      await controller.expectStopped();
    });
  });

  it("should run a quick evaluation with a bigint-valued result column", async () => {
    await withDebugController(appCommands, async (controller) => {
      const semver = await cli.getVersion();
      if (semver.compare("2.18.4") < 0) {
        // Skip this test if the CLI version is too old to support BigInt
        return;
      }

      await selectForQuickEval(quickEvalBigIntQueryPath, 4, 23, 4, 37);

      // Don't specify a query path, so we'll default to the active document ("QuickEvalBigIntQuery.ql")
      await controller.startDebuggingSelection({});
      await controller.expectLaunched();
      const result = await controller.expectSucceeded();
      expect(result.started.quickEvalContext).toBeDefined();
      expect(result.started.quickEvalContext!.quickEvalText).toBe(
        "getBigIntValue",
      );
      expect(result.results.queryTarget.quickEvalPosition).toBeDefined();
      expect(await getResultCount(result.results.outputDir, cli)).toBe(8);
      await controller.expectStopped();
    });
  });

  it("should save dirty documents before launching a debug session", async () => {
    await withDebugController(appCommands, async (controller) => {
      const editor = await selectForQuickEval(quickEvalLibPath, 4, 15, 4, 32);
      expect(editor.document.isDirty).toBe(false);

      await controller.startDebuggingSelection({
        query: quickEvalQueryPath, // The query context. This query extends the abstract class.
      });
      await controller.expectLaunched();

      // Should have saved the dirty document.
      expect(editor.document.isDirty).toBe(false);

      await controller.expectSucceeded();
      await controller.expectStopped();

      await editor.edit((editBuilder) => {
        editBuilder.insert(new Position(0, 0), "/* another comment */");
      });
      expect(editor.document.isDirty).toBe(true);

      await controller.continueDebuggingSelection();
      await controller.expectSucceeded();
      await controller.expectStopped();
      expect(editor.document.isDirty).toBe(false);
    });
  });

  it("should pass additionalArgs through to query server", async () => {
    await withDebugController(appCommands, async (controller) => {
      await controller.startDebugging(
        {
          query: quickEvalQueryPath,
          additionalRunQueryArgs: {
            // Overrides the value passed to the query server
            queryPath: simpleQueryPath,
          },
        },
        true,
      );
      await controller.expectLaunched();
      const result = await controller.expectSucceeded();
      await controller.expectExited();
      await controller.expectTerminated();
      await controller.expectSessionClosed();

      // Expect the number of results to be the same as if we had run the simple query, not the quick eval query.
      expect(await getResultCount(result.results.outputDir, cli)).toBe(2);
    });
  });
});
