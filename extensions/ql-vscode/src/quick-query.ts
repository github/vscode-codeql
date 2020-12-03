import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { CancellationToken, ExtensionContext, window as Window, workspace, Uri } from 'vscode';
import { ErrorCodes, ResponseError } from 'vscode-languageclient';
import { CodeQLCliServer } from './cli';
import { DatabaseUI } from './databases-ui';
import { logger } from './logging';
import {
  getInitialQueryContents,
  getPrimaryDbscheme,
  getQlPackForDbscheme,
  ProgressCallback,
  showAndLogErrorMessage,
  showBinaryChoiceDialog,
  UserCancellationException
} from './helpers';

const QUICK_QUERIES_DIR_NAME = 'quick-queries';
const QUICK_QUERY_QUERY_NAME = 'quick-query.ql';
const QUICK_QUERY_WORKSPACE_FOLDER_NAME = 'Quick Queries';

export function isQuickQueryPath(queryPath: string): boolean {
  return path.basename(queryPath) === QUICK_QUERY_QUERY_NAME;
}

function getQuickQueriesDir(ctx: ExtensionContext): string {
  const storagePath = ctx.storagePath;
  if (storagePath === undefined) {
    throw new Error('Workspace storage path is undefined');
  }
  const queriesPath = path.join(storagePath, QUICK_QUERIES_DIR_NAME);
  fs.ensureDir(queriesPath, { mode: 0o700 });
  return queriesPath;
}




/**
 * Show a buffer the user can enter a simple query into.
 */
export async function displayQuickQuery(
  ctx: ExtensionContext,
  cliServer: CodeQLCliServer,
  databaseUI: DatabaseUI,
  progress: ProgressCallback,
  token: CancellationToken
) {

  function updateQuickQueryDir(queriesDir: string, index: number, len: number) {
    workspace.updateWorkspaceFolders(
      index,
      len,
      { uri: Uri.file(queriesDir), name: QUICK_QUERY_WORKSPACE_FOLDER_NAME }
    );
  }

  try {
    const workspaceFolders = workspace.workspaceFolders || [];
    const queriesDir = await getQuickQueriesDir(ctx);

    // If there is already a quick query open, don't clobber it, just
    // show it.
    const existing = workspace.textDocuments.find(doc => path.basename(doc.uri.fsPath) === QUICK_QUERY_QUERY_NAME);
    if (existing !== undefined) {
      Window.showTextDocument(existing);
      return;
    }

    // We need to have a multi-root workspace to make quick query work
    // at all. Changing the workspace from single-root to multi-root
    // causes a restart of the whole extension host environment, so we
    // basically can't do anything that survives that restart.
    //
    // So if we are currently in a single-root workspace (of which the
    // only reliable signal appears to be `workspace.workspaceFile`
    // being undefined) just let the user know that they're in for a
    // restart.
    if (workspace.workspaceFile === undefined) {
      const makeMultiRoot = await showBinaryChoiceDialog('Quick query requires multiple folders in the workspace. Reload workspace as multi-folder workspace?');
      if (makeMultiRoot) {
        updateQuickQueryDir(queriesDir, workspaceFolders.length, 0);
      }
      return;
    }

    const index = workspaceFolders.findIndex(folder => folder.name === QUICK_QUERY_WORKSPACE_FOLDER_NAME);
    if (index === -1)
      updateQuickQueryDir(queriesDir, workspaceFolders.length, 0);
    else
      updateQuickQueryDir(queriesDir, index, 1);

    // We're going to infer which qlpack to use from the current database
    const dbItem = await databaseUI.getDatabaseItem(progress, token);
    if (dbItem === undefined) {
      throw new Error('Can\'t start quick query without a selected database');
    }

    const datasetFolder = await dbItem.getDatasetFolder(cliServer);
    const dbscheme = await getPrimaryDbscheme(datasetFolder);
    const qlpack = await getQlPackForDbscheme(cliServer, dbscheme);

    const quickQueryQlpackYaml: any = {
      name: 'quick-query',
      version: '1.0.0',
      libraryPathDependencies: [qlpack]
    };

    const qlFile = path.join(queriesDir, QUICK_QUERY_QUERY_NAME);
    const qlPackFile = path.join(queriesDir, 'qlpack.yml');
    await fs.writeFile(qlFile, getInitialQueryContents(dbItem.language, dbscheme), 'utf8');
    await fs.writeFile(qlPackFile, yaml.safeDump(quickQueryQlpackYaml), 'utf8');
    Window.showTextDocument(await workspace.openTextDocument(qlFile));
  }

  // TODO: clean up error handling for top-level commands like this
  catch (e) {
    if (e instanceof UserCancellationException) {
      logger.log(e.message);
    }
    else if (e instanceof ResponseError && e.code == ErrorCodes.RequestCancelled) {
      logger.log(e.message);
    }
    else if (e instanceof Error)
      showAndLogErrorMessage(e.message);
    else
      throw e;
  }
}
