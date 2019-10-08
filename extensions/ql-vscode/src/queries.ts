import * as path from 'path';
import * as tmp from 'tmp';
import * as vscode from 'vscode';
import { ExtensionContext, ProgressLocation, window as Window, workspace } from 'vscode';
import { DatabaseManager, DatabaseItem } from './databases';
import * as qsClient from './queryserver-client';
import { QLConfiguration } from './config';
import { DatabaseInfo } from './interface-types';
import * as messages from './messages';

/**
 * queries.ts
 * -------------
 *
 * Compiling and running QL queries.
 */

// XXX: Tmp directory should be configuarble.
export const tmpDir = tmp.dirSync({ prefix: 'queries_', keep: false, unsafeCleanup: true });
export const tmpDirDisposal = {
  dispose: () => {
    tmpDir.removeCallback();
  }
};

let queryCounter = 0;

/**
 * A collection of evaluation-time information about a query,
 * including the query itself, and where we have decided to put
 * temporary files associated with it, such as the compiled query
 * output and results.
 */
class QueryInfo {
  program: messages.QlProgram;
  quickEvalPosition?: messages.Position;
  compiledQueryPath: string;
  resultsPath: string;
  dbItem: DatabaseItem;
  db: vscode.Uri; // guarantee the existence of a well-defined db dir at this point

  constructor(program: messages.QlProgram, dbItem: DatabaseItem, quickEvalPosition?: messages.Position) {
    this.program = program;
    this.quickEvalPosition = quickEvalPosition;
    this.compiledQueryPath = path.join(tmpDir.name, `compiledQuery${queryCounter}.qlo`);
    this.resultsPath = path.join(tmpDir.name, `results${queryCounter}.bqrs`);
    if (dbItem.contents === undefined) {
      throw new Error('Can\'t run query on invalid snapshot.');
    }
    this.db = dbItem.contents.databaseUri;
    this.dbItem = dbItem;
    queryCounter++;
  }

  async run(
    qs: qsClient.Server,
  ): Promise<messages.EvaluationResult> {
    let result: messages.EvaluationResult | null = null;

    const callbackId = qs.registerCallback(res => { result = res });

    const queryToRun: messages.QueryToRun = {
      resultsPath: this.resultsPath,
      qlo: vscode.Uri.file(this.compiledQueryPath).toString(),
      allowUnknownTemplates: true,
      id: callbackId,
      timeoutSecs: 1000, // XXX timeout should be configurable
    }
    const db: messages.Database = {
      dbDir: this.db.fsPath,
      workingSet: 'default'
    }
    const params: messages.EvaluateQueriesParams = {
      db,
      evaluateId: callbackId,
      queries: [queryToRun],
      stopOnError: false,
      useSequenceHint: false
    }
    try {
      await withProgress({
        location: ProgressLocation.Notification,
        title: "Running Query",
        cancellable: false,
      }, (progress, token) => {
        return qs.sendRequest(messages.runQueries, params, token, progress)
      });
    } finally {
      qs.unRegisterCallback(callbackId);
    }
    return result || { evaluationTime: 0, message: "No result from server", queryId: -1, runId: callbackId, resultType: messages.QueryResultType.OTHER_ERROR };
  }

  async compileAndRun(
    qs: qsClient.Server,
  ): Promise<messages.EvaluationResult> {
    let compiled: messages.CheckQueryResult;
    try {
      const params: messages.CompileQueryParams = {
        compilationOptions: {
          computeNoLocationUrls: true,
          failOnWarnings: false,
          fastCompilation: false,
          includeDilInQlo: true,
          localChecking: false,
          noComputeGetUrl: false,
          noComputeToString: false,
        },
        queryToCheck: this.program,
        resultPath: this.compiledQueryPath,
        target: { query: {} }
      };


      compiled = await withProgress({
        location: ProgressLocation.Notification,
        title: "Compiling Query",
        cancellable: false,
      }, (progress, token) => {
        return qs.sendRequest(messages.compileQuery, params, token, progress);
      });
    } finally {
      qs.log(" - - - COMPILATION DONE - - - ");
    }

    const errors = (compiled.messages || []).filter(msg => msg.severity == 0);
    if (errors.length == 0) {
      return await this.run(qs);
    }
    else {
      errors.forEach(err =>
        Window.showErrorMessage(err.message || "[no error message available]")
      );
      return {
        evaluationTime: 0,
        resultType: messages.QueryResultType.OTHER_ERROR,
        queryId: 0,
        runId: 0,
        message: "Query had compilation errors"
      }
    }
  }
}

export interface EvaluationInfo {
  query: QueryInfo;
  result: messages.EvaluationResult;
  database: DatabaseInfo;
}

/**
 * Start the query server.
 */
export function spawnQueryServer(config: QLConfiguration): qsClient.Server | undefined {
  //TODO: Handle configuration changes, query server crashes, etc.
  const semmleDist = config.qlDistributionPath;
  if (semmleDist) {
    const outputChannel = Window.createOutputChannel('QL Query Server');
    outputChannel.append("starting jsonrpc query server\n");
    const server = new qsClient.Server(config.configData, {
      logger: s => outputChannel.append(s + "\n"),
    });
    outputChannel.append("query server started on pid:" + server.getPid() + "\n");
    return server;
  } else {
    return undefined;
  }
}

/**
 * This mediates between the kind of progress callbacks we want to
 * write (where we *set* current progress position and give
 * `maxSteps`) and the kind vscode progress api expects us to write
 * (which increment progress by a certain amount out of 100%)
 */
function withProgress<R>(
  options: vscode.ProgressOptions,
  task: (
    progress: (p: messages.ProgressMessage) => void,
    token: vscode.CancellationToken
  ) => Thenable<R>
): Thenable<R> {
  let progressAchieved = 0;
  return Window.withProgress(options,
    (progress, token) => {
      return task(p => {
        const { message, step, maxStep } = p;
        const increment = 100 * (step - progressAchieved) / maxStep;
        progressAchieved = step;
        progress.report({ message, increment });
      }, token);
    });
}

export async function clearCacheInDatabase(qs: qsClient.Server, dbItem: DatabaseItem):
  Promise<messages.ClearCacheResult> {
  if (dbItem.contents === undefined) {
    throw new Error('Can\'t run query on invalid snapshot.');
  }

  const db: messages.Database = {
    dbDir: dbItem.contents.databaseUri.fsPath,
    workingSet: 'default',
  };

  const params: messages.ClearCacheParams = {
    dryRun: false,
    db,
  };

  return withProgress({
    location: ProgressLocation.Notification,
    title: "Clearing Cache",
    cancellable: false,
  }, (progress, token) =>
      qs.sendRequest(messages.clearCache, params, token, progress)
  );
}

export async function compileAndRunQueryAgainstDatabase(
  qs: qsClient.Server,
  db: DatabaseItem,
  quickEval?: boolean
): Promise<EvaluationInfo> {
  const config = workspace.getConfiguration('ql');
  const root = workspace.rootPath;
  const editor = Window.activeTextEditor;
  if (root == undefined) {
    throw new Error('Can\'t run query with undefined workspace');
  }
  if (editor == undefined) {
    throw new Error('Can\'t run query without an active editor');
  }
  const qlProgram: messages.QlProgram = {
    libraryPath: config.projects['.'].libraryPath.map(lp => path.join(root, lp)),
    dbschemePath: path.join(root, config.projects['.'].dbScheme),
    queryPath: editor.document.fileName
  };
  let quickEvalPosition: messages.Position | undefined;
  if (quickEval) {
    const pos = editor.selection.anchor;
    const posEnd = editor.selection.active;
    // Convert from 0-based to 1-based line and column numbers.
    quickEvalPosition = {
      fileName: editor.document.fileName,
      line: pos.line + 1, column: pos.character + 1,
      endLine: posEnd.line + 1, endColumn: posEnd.character + 1
    }
  }

  const query = new QueryInfo(qlProgram, db, quickEvalPosition);
  return {
    query,
    result: await query.compileAndRun(qs),
    database: {
      name: db.name,
      snapshotUri: db.snapshotUri.toString(true)
    }
  };
}
