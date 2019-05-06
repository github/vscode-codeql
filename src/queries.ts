import * as path from 'path';
import * as tmp from 'tmp';
import * as vscode from 'vscode';
import { ExtensionContext, ProgressLocation, window as Window, workspace } from 'vscode';
import * as compilation from '../gen/compilation_server_protocol_pb';
import { ProgressUpdate } from '../gen/core_messages_protocol_pb';
import * as evaluation from '../gen/evaluation_server_protocol_pb';
import { DatabaseManager, DatabaseItem } from './databases';
import * as qsClient from './queryserver-client';
import { QLConfiguration } from './config';

/**
 * queries.ts
 * -------------
 *
 * Compiling and running QL queries.
 */

const tmpDir = tmp.dirSync({ prefix: 'queries_', keep: false, unsafeCleanup: true });
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
  program: compilation.QlProgram;
  quickEvalPosition?: qsClient.Position;
  compiledQueryPath: string;
  resultsPath: string;
  dbItem: DatabaseItem;
  db: vscode.Uri; // guarantee the existence of a well-defined db dir at this point

  constructor(program: compilation.QlProgram, dbItem: DatabaseItem, quickEvalPosition?: qsClient.Position) {
    this.program = program;
    this.quickEvalPosition = quickEvalPosition;
    this.compiledQueryPath = path.join(tmpDir.name, `compiledQuery${queryCounter}.qlo`);
    this.resultsPath = path.join(tmpDir.name, `results${queryCounter}.bqrs`);
    if (dbItem.dbUri == undefined) {
      throw new Error('Can\'t run query without valid database directory');
    }
    this.db = dbItem.dbUri;
    this.dbItem = dbItem;
    queryCounter++;
  }

  async run(
    qs: qsClient.Server,
  ): Promise<evaluation.Result.AsObject> {
    const queryToRun = new evaluation.QueryToRun();
    queryToRun.setResultPath(this.resultsPath);
    queryToRun.setQloUri(vscode.Uri.file(this.compiledQueryPath).toString());
    queryToRun.setTimeoutSecs(1000);
    queryToRun.setAllowUnkownTemplates(true);
    const db = new evaluation.Database();
    db.setDatabaseDirectory(this.db.fsPath);
    db.setWorkingSet('default');

    return withProgress({
      location: ProgressLocation.Notification,
      title: "Running Query",
      cancellable: false,
    }, (progress, token) => {
      return new Promise<evaluation.Result.AsObject>((resolve, reject) => {
        qs.runQuery(queryToRun, db,
          {
            onProgress: progress,
            onResult: resolve,
            onDone: () => {
              qs.log(" - - - DONE RUNNING QUERY - - - ");
            },
          }
        );
      });
    });
  }

  async compileAndRun(
    qs: qsClient.Server,
  ): Promise<evaluation.Result.AsObject> {
    return withProgress({
      location: ProgressLocation.Notification,
      title: "Compiling Query",
      cancellable: false,
    }, (progress, token) => {
      return new Promise<evaluation.Result.AsObject>((resolve, reject) => {
        qs.compileQuery(this.program,
          this.compiledQueryPath,
          {
            onProgress: progress,
            onResult: x => {
              const errors = x.messagesList.filter(msg => msg.severity == 0);
              if (errors.length == 0) {
                resolve(this.run(qs));
              }
              else {
                errors.forEach(err =>
                  Window.showErrorMessage(err.message)
                );
              }
            },
            onDone: () => {
              qs.log(" - - - COMPILATION DONE - - - ");
            },
          },
          this.quickEvalPosition,
        );
      });
    });

  }
}

export type EvaluationInfo = {
  query: QueryInfo,
  result: evaluation.Result.AsObject,
}

/**
 * Start the query server.
 */
export function spawnQueryServer(config: QLConfiguration): qsClient.Server | undefined {
  const semmleDist = config.qlDistributionPath;
  if (semmleDist) {
    const outputChannel = Window.createOutputChannel('QL Queryserver Debug');
    outputChannel.append("starting query server\n");
    const server = new qsClient.Server(config, {
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
    progress: (p: ProgressUpdate.AsObject) => void,
    token: vscode.CancellationToken
  ) => Thenable<R>
): Thenable<R> {
  let progressAchieved = 0;
  return Window.withProgress(options,
    (progress, token) => {
      return task(p => {
        const { text, step, maxStep } = p;
        const increment = 100 * (step - progressAchieved) / maxStep;
        progressAchieved = step;
        progress.report({ message: text, increment });
      }, token);
    });
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
  const qlProgram = new compilation.QlProgram();
  qlProgram.setLibraryPathList(config.projects['.'].libraryPath.map(lp => path.join(root, lp)));
  qlProgram.setDbschemePath(path.join(root, config.projects['.'].dbScheme));
  qlProgram.setQueryPath(editor.document.fileName);

  let quickEvalPosition: qsClient.Position | undefined;
  if (quickEval) {
    const pos = editor.selection.anchor;
    const posEnd = editor.selection.active;
    quickEvalPosition = {
      file: editor.document.fileName,
      line: pos.line + 1, column: pos.character + 1,
      endLine: posEnd.line + 1, endColumn: posEnd.character + 1
    }
  }

  const query = new QueryInfo(qlProgram, db, quickEvalPosition);
  return { query, result: await query.compileAndRun(qs) };
}
