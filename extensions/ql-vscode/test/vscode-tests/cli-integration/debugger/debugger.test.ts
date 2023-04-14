import { Selection, Uri, window, workspace } from "vscode";
import { join } from "path";

import { DatabaseManager } from "../../../../src/local-databases";
import {
  cleanDatabases,
  ensureTestDatabase,
  getActivatedExtension,
} from "../../global.helper";
import { describeWithCodeQL } from "../../cli";
import { withDebugController } from "./debug-controller";
import { CodeQLCliServer } from "../../../../src/cli";
import { QueryOutputDir } from "../../../../src/run-queries-shared";
import { createVSCodeCommandManager } from "../../../../src/common/vscode/commands";
import { AllCommands } from "../../../../src/common/commands";

async function selectForQuickEval(
  path: string,
  line: number,
  column: number,
  endLine: number,
  endColumn: number,
): Promise<void> {
  const document = await workspace.openTextDocument(path);
  const editor = await window.showTextDocument(document);
  editor.selection = new Selection(line, column, endLine, endColumn);
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
  const simpleQueryPath = join(__dirname, "..", "data", "simple-query.ql");
  const quickEvalQueryPath = join(__dirname, "..", "data", "QuickEvalQuery.ql");
  const quickEvalLibPath = join(__dirname, "..", "data", "QuickEvalLib.qll");

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
});
