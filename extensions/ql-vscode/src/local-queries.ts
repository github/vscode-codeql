import {
  commandRunnerWithProgress,
  ProgressCallback,
  ProgressUpdate,
} from "./commandRunner";
import {
  CancellationToken,
  CancellationTokenSource,
  ExtensionContext,
  QuickPickItem,
  Range,
  Uri,
  window,
} from "vscode";
import { extLogger, queryServerLogger } from "./common";
import { MAX_QUERIES } from "./config";
import { gatherQlFiles } from "./pure/files";
import { basename } from "path";
import {
  findLanguage,
  showAndLogErrorMessage,
  showAndLogWarningMessage,
  showBinaryChoiceDialog,
} from "./helpers";
import { displayQuickQuery } from "./quick-query";
import { QueryRunner } from "./queryRunner";
import { QueryHistoryManager } from "./query-history/query-history-manager";
import { DatabaseUI } from "./local-databases-ui";
import { ResultsView } from "./interface";
import { DatabaseItem, DatabaseManager } from "./local-databases";
import { createInitialQueryInfo } from "./run-queries-shared";
import { CompletedLocalQueryInfo, LocalQueryInfo } from "./query-results";
import { WebviewReveal } from "./interface-utils";
import { asError, getErrorMessage } from "./pure/helpers-pure";
import { CodeQLCliServer } from "./cli";

type LocalQueryOptions = {
  queryRunner: QueryRunner;
  queryHistoryManager: QueryHistoryManager;
  databaseManager: DatabaseManager;
  cliServer: CodeQLCliServer;
  databaseUI: DatabaseUI;
  localQueryResultsView: ResultsView;
  queryStorageDir: string;
};

export function registerLocalQueryCommands(
  ctx: ExtensionContext,
  {
    queryRunner,
    queryHistoryManager,
    databaseManager,
    cliServer,
    databaseUI,
    localQueryResultsView,
    queryStorageDir,
  }: LocalQueryOptions,
) {
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.runQuery",
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        uri: Uri | undefined,
      ) =>
        await compileAndRunQuery(
          queryRunner,
          queryHistoryManager,
          databaseUI,
          localQueryResultsView,
          queryStorageDir,
          false,
          uri,
          progress,
          token,
          undefined,
        ),
      {
        title: "Running query",
        cancellable: true,
      },

      // Open the query server logger on error since that's usually where the interesting errors appear.
      queryServerLogger,
    ),
  );

  // Since we are tracking extension usage through commands, this command mirrors the runQuery command
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.runQueryContextEditor",
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        uri: Uri | undefined,
      ) =>
        await compileAndRunQuery(
          queryRunner,
          queryHistoryManager,
          databaseUI,
          localQueryResultsView,
          queryStorageDir,
          false,
          uri,
          progress,
          token,
          undefined,
        ),
      {
        title: "Running query",
        cancellable: true,
      },

      // Open the query server logger on error since that's usually where the interesting errors appear.
      queryServerLogger,
    ),
  );
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.runQueryOnMultipleDatabases",
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        uri: Uri | undefined,
      ) =>
        await compileAndRunQueryOnMultipleDatabases(
          cliServer,
          queryRunner,
          queryHistoryManager,
          databaseManager,
          databaseUI,
          localQueryResultsView,
          queryStorageDir,
          progress,
          token,
          uri,
        ),
      {
        title: "Running query on selected databases",
        cancellable: true,
      },
    ),
  );
  // Since we are tracking extension usage through commands, this command mirrors the runQueryOnMultipleDatabases command
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.runQueryOnMultipleDatabasesContextEditor",
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        uri: Uri | undefined,
      ) =>
        await compileAndRunQueryOnMultipleDatabases(
          cliServer,
          queryRunner,
          queryHistoryManager,
          databaseManager,
          databaseUI,
          localQueryResultsView,
          queryStorageDir,
          progress,
          token,
          uri,
        ),
      {
        title: "Running query on selected databases",
        cancellable: true,
      },
    ),
  );
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.runQueries",
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        _: Uri | undefined,
        multi: Uri[],
      ) => {
        const maxQueryCount = MAX_QUERIES.getValue() as number;
        const [files, dirFound] = await gatherQlFiles(
          multi.map((uri) => uri.fsPath),
        );
        if (files.length > maxQueryCount) {
          throw new Error(
            `You tried to run ${files.length} queries, but the maximum is ${maxQueryCount}. Try selecting fewer queries or changing the 'codeQL.runningQueries.maxQueries' setting.`,
          );
        }
        // warn user and display selected files when a directory is selected because some ql
        // files may be hidden from the user.
        if (dirFound) {
          const fileString = files.map((file) => basename(file)).join(", ");
          const res = await showBinaryChoiceDialog(
            `You are about to run ${files.length} queries: ${fileString} Do you want to continue?`,
          );
          if (!res) {
            return;
          }
        }
        const queryUris = files.map((path) => Uri.parse(`file:${path}`, true));

        // Use a wrapped progress so that messages appear with the queries remaining in it.
        let queriesRemaining = queryUris.length;
        function wrappedProgress(update: ProgressUpdate) {
          const message =
            queriesRemaining > 1
              ? `${queriesRemaining} remaining. ${update.message}`
              : update.message;
          progress({
            ...update,
            message,
          });
        }

        wrappedProgress({
          maxStep: queryUris.length,
          step: queryUris.length - queriesRemaining,
          message: "",
        });

        await Promise.all(
          queryUris.map(async (uri) =>
            compileAndRunQuery(
              queryRunner,
              queryHistoryManager,
              databaseUI,
              localQueryResultsView,
              queryStorageDir,
              false,
              uri,
              wrappedProgress,
              token,
              undefined,
            ).then(() => queriesRemaining--),
          ),
        );
      },
      {
        title: "Running queries",
        cancellable: true,
      },

      // Open the query server logger on error since that's usually where the interesting errors appear.
      queryServerLogger,
    ),
  );

  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.quickEval",
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        uri: Uri | undefined,
      ) =>
        await compileAndRunQuery(
          queryRunner,
          queryHistoryManager,
          databaseUI,
          localQueryResultsView,
          queryStorageDir,
          true,
          uri,
          progress,
          token,
          undefined,
        ),
      {
        title: "Running query",
        cancellable: true,
      },
      // Open the query server logger on error since that's usually where the interesting errors appear.
      queryServerLogger,
    ),
  );

  // Since we are tracking extension usage through commands, this command mirrors the "codeQL.quickEval" command
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.quickEvalContextEditor",
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        uri: Uri | undefined,
      ) =>
        await compileAndRunQuery(
          queryRunner,
          queryHistoryManager,
          databaseUI,
          localQueryResultsView,
          queryStorageDir,
          true,
          uri,
          progress,
          token,
          undefined,
        ),
      {
        title: "Running query",
        cancellable: true,
      },
      // Open the query server logger on error since that's usually where the interesting errors appear.
      queryServerLogger,
    ),
  );

  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.codeLensQuickEval",
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        uri: Uri,
        range: Range,
      ) =>
        await compileAndRunQuery(
          queryRunner,
          queryHistoryManager,
          databaseUI,
          localQueryResultsView,
          queryStorageDir,
          true,
          uri,
          progress,
          token,
          undefined,
          range,
        ),
      {
        title: "Running query",
        cancellable: true,
      },

      // Open the query server logger on error since that's usually where the interesting errors appear.
      queryServerLogger,
    ),
  );

  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.quickQuery",
      async (progress: ProgressCallback, token: CancellationToken) =>
        displayQuickQuery(ctx, cliServer, databaseUI, progress, token),
      {
        title: "Run Quick Query",
      },

      // Open the query server logger on error since that's usually where the interesting errors appear.
      queryServerLogger,
    ),
  );
}

export async function compileAndRunQuery(
  qs: QueryRunner,
  qhm: QueryHistoryManager,
  databaseUI: DatabaseUI,
  localQueryResultsView: ResultsView,
  queryStorageDir: string,
  quickEval: boolean,
  selectedQuery: Uri | undefined,
  progress: ProgressCallback,
  token: CancellationToken,
  databaseItem: DatabaseItem | undefined,
  range?: Range,
): Promise<void> {
  if (qs !== undefined) {
    // If no databaseItem is specified, use the database currently selected in the Databases UI
    databaseItem =
      databaseItem || (await databaseUI.getDatabaseItem(progress, token));
    if (databaseItem === undefined) {
      throw new Error("Can't run query without a selected database");
    }
    const databaseInfo = {
      name: databaseItem.name,
      databaseUri: databaseItem.databaseUri.toString(),
    };

    // handle cancellation from the history view.
    const source = new CancellationTokenSource();
    token.onCancellationRequested(() => source.cancel());

    const initialInfo = await createInitialQueryInfo(
      selectedQuery,
      databaseInfo,
      quickEval,
      range,
    );
    const item = new LocalQueryInfo(initialInfo, source);
    qhm.addQuery(item);
    try {
      const completedQueryInfo = await qs.compileAndRunQueryAgainstDatabase(
        databaseItem,
        initialInfo,
        queryStorageDir,
        progress,
        source.token,
        undefined,
        item,
      );
      qhm.completeQuery(item, completedQueryInfo);
      await showResultsForCompletedQuery(
        localQueryResultsView,
        item as CompletedLocalQueryInfo,
        WebviewReveal.Forced,
      );
      // Note we must update the query history view after showing results as the
      // display and sorting might depend on the number of results
    } catch (e) {
      const err = asError(e);
      err.message = `Error running query: ${err.message}`;
      item.failureReason = err.message;
      throw e;
    } finally {
      await qhm.refreshTreeView();
      source.dispose();
    }
  }
}

interface DatabaseQuickPickItem extends QuickPickItem {
  databaseItem: DatabaseItem;
}

async function compileAndRunQueryOnMultipleDatabases(
  cliServer: CodeQLCliServer,
  qs: QueryRunner,
  qhm: QueryHistoryManager,
  dbm: DatabaseManager,
  databaseUI: DatabaseUI,
  localQueryResultsView: ResultsView,
  queryStorageDir: string,
  progress: ProgressCallback,
  token: CancellationToken,
  uri: Uri | undefined,
): Promise<void> {
  let filteredDBs = dbm.databaseItems;
  if (filteredDBs.length === 0) {
    void showAndLogErrorMessage(
      "No databases found. Please add a suitable database to your workspace.",
    );
    return;
  }
  // If possible, only show databases with the right language (otherwise show all databases).
  const queryLanguage = await findLanguage(cliServer, uri);
  if (queryLanguage) {
    filteredDBs = dbm.databaseItems.filter(
      (db) => db.language === queryLanguage,
    );
    if (filteredDBs.length === 0) {
      void showAndLogErrorMessage(
        `No databases found for language ${queryLanguage}. Please add a suitable database to your workspace.`,
      );
      return;
    }
  }
  const quickPickItems = filteredDBs.map<DatabaseQuickPickItem>((dbItem) => ({
    databaseItem: dbItem,
    label: dbItem.name,
    description: dbItem.language,
  }));
  /**
   * Databases that were selected in the quick pick menu.
   */
  const quickpick = await window.showQuickPick<DatabaseQuickPickItem>(
    quickPickItems,
    { canPickMany: true, ignoreFocusOut: true },
  );
  if (quickpick !== undefined) {
    // Collect all skipped databases and display them at the end (instead of popping up individual errors)
    const skippedDatabases = [];
    const errors = [];
    for (const item of quickpick) {
      try {
        await compileAndRunQuery(
          qs,
          qhm,
          databaseUI,
          localQueryResultsView,
          queryStorageDir,
          false,
          uri,
          progress,
          token,
          item.databaseItem,
        );
      } catch (e) {
        skippedDatabases.push(item.label);
        errors.push(getErrorMessage(e));
      }
    }
    if (skippedDatabases.length > 0) {
      void extLogger.log(`Errors:\n${errors.join("\n")}`);
      void showAndLogWarningMessage(
        `The following databases were skipped:\n${skippedDatabases.join(
          "\n",
        )}.\nFor details about the errors, see the logs.`,
      );
    }
  } else {
    void showAndLogErrorMessage("No databases selected.");
  }
}

export async function showResultsForCompletedQuery(
  localQueryResultsView: ResultsView,
  query: CompletedLocalQueryInfo,
  forceReveal: WebviewReveal,
): Promise<void> {
  await localQueryResultsView.showResults(query, forceReveal, false);
}
