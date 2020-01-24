import * as fs from 'fs-extra';
import * as glob from 'glob-promise';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { ExtensionContext, window as Window, workspace, Uri } from 'vscode';
import { ErrorCodes, ResponseError } from 'vscode-languageclient';
import { CodeQLCliServer } from './cli';
import { DatabaseUI } from './databases-ui';
import * as helpers from './helpers';
import { logger } from './logging';
import { UserCancellationException } from './queries';

const QUICK_QUERIES_DIR_NAME = 'quick-queries';
const QUICK_QUERY_QUERY_NAME = 'quick-query.ql';

export function isQuickQueryPath(queryPath: string): boolean {
  return path.basename(queryPath) === QUICK_QUERY_QUERY_NAME;
}

async function getQlPackFor(cliServer: CodeQLCliServer, dbschemePath: string): Promise<string> {
  const qlpacks = await cliServer.resolveQlpacks(helpers.getOnDiskWorkspaceFolders());
  const packs: { packDir: string | undefined, packName: string }[] =
    Object.entries(qlpacks).map(([packName, dirs]) => {
      if (dirs.length < 1) {
        logger.log(`In getQlPackFor ${dbschemePath}, qlpack ${packName} has no directories`);
        return { packName, packDir: undefined };
      }
      if (dirs.length > 1) {
        logger.log(`In getQlPackFor ${dbschemePath}, qlpack ${packName} has more than one directory; arbitrarily choosing the first`);
      }
      return {
        packName,
        packDir: dirs[0]
      }
    });
  for (const { packDir, packName } of packs) {
    if (packDir !== undefined) {
      const qlpack = yaml.safeLoad(await fs.readFile(path.join(packDir, 'qlpack.yml'), 'utf8'));
      if (qlpack.dbscheme !== undefined && path.basename(qlpack.dbscheme) === path.basename(dbschemePath)) {
        return packName;
      }
    }
  }
  throw new Error(`Could not find qlpack file for dbscheme ${dbschemePath}`);
}

/**
 * `getBaseText` heuristically returns an appropriate import statement
 * prelude based on the filename of the dbscheme file given. TODO: add
 * a 'default import' field to the qlpack itself, and use that.
 */
function getBaseText(dbschemeBase: string) {
  if (dbschemeBase == 'semmlecode.javascript.dbscheme') return 'import javascript\n\nselect ""';
  if (dbschemeBase == 'semmlecode.cpp.dbscheme') return 'import cpp\n\nselect ""';
  if (dbschemeBase == 'semmlecode.dbscheme') return 'import java\n\nselect ""';
  if (dbschemeBase == 'semmlecode.python.dbscheme') return 'import python\n\nselect ""';
  if (dbschemeBase == 'semmlecode.csharp.dbscheme') return 'import csharp\n\nselect ""';
  if (dbschemeBase == 'go.dbscheme') return 'import go\n\nselect ""';
  return 'select ""';
}

async function getQuickQueriesDir(ctx: ExtensionContext): Promise<string> {
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
export async function displayQuickQuery(ctx: ExtensionContext, cliServer: CodeQLCliServer, databaseUI: DatabaseUI) {
  try {

    // If there is already a quick query open, don't clobber it, just
    // show it.
    const existing = workspace.textDocuments.find(doc => path.basename(doc.uri.fsPath) === QUICK_QUERY_QUERY_NAME);
    if (existing !== undefined) {
      Window.showTextDocument(existing);
      return;
    }

    const queriesDir = await getQuickQueriesDir(ctx);

    // We need this folder in workspace folders so the language server
    // knows how to find its qlpack.yml
    if (workspace.workspaceFolders === undefined
      || !workspace.workspaceFolders.some(folder => folder.uri.fsPath === queriesDir)) {
      workspace.updateWorkspaceFolders(
        (workspace.workspaceFolders || []).length,
        0,
        { uri: Uri.file(queriesDir), name: "Quick Queries" }
      );
    }

    // We're going to infer which qlpack to use from the current database
    const dbItem = await databaseUI.getDatabaseItem();
    if (dbItem === undefined) {
      throw new Error('Can\'t start quick query without a selected database');
    }

    const datasetFolder = await dbItem.getDatasetFolder(cliServer);
    const dbschemes = await glob(path.join(datasetFolder, '*.dbscheme'))

    if (dbschemes.length < 1) {
      throw new Error(`Can't find dbscheme for current database in ${datasetFolder}`);
    }

    dbschemes.sort();
    const dbscheme = dbschemes[0];
    if (dbschemes.length > 1) {
      Window.showErrorMessage(`Found multiple dbschemes in ${datasetFolder} during quick query; arbitrarily choosing the first, ${dbscheme}, to decide what library to use.`);
    }

    const qlpack = await getQlPackFor(cliServer, dbscheme);
    const quickQueryQlpackYaml: any = {
      name: "quick-query",
      version: "1.0.0",
      libraryPathDependencies: [qlpack]
    };

    const qlFile = path.join(queriesDir, QUICK_QUERY_QUERY_NAME);
    const qlPackFile = path.join(queriesDir, 'qlpack.yml');
    await fs.writeFile(qlFile, getBaseText(path.basename(dbscheme)), 'utf8');
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
      helpers.showAndLogErrorMessage(e.message);
    else
      throw e;
  }
}
