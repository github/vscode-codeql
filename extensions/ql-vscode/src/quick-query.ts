import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import * as path from "path";
import {
  CancellationToken,
  ExtensionContext,
  window as Window,
  workspace,
  Uri,
} from "vscode";
import { LSPErrorCodes, ResponseError } from "vscode-languageclient";
import { CodeQLCliServer } from "./cli";
import { DatabaseUI } from "./databases-ui";
import {
  getInitialQueryContents,
  getPrimaryDbscheme,
  getQlPackForDbscheme,
  showBinaryChoiceDialog,
} from "./helpers";
import { ProgressCallback, UserCancellationException } from "./commandRunner";
import { getErrorMessage } from "./pure/helpers-pure";

const QUICK_QUERIES_DIR_NAME = "quick-queries";
const QUICK_QUERY_QUERY_NAME = "quick-query.ql";
const QUICK_QUERY_WORKSPACE_FOLDER_NAME = "Quick Queries";
const QLPACK_FILE_HEADER = "# This is an automatically generated file.\n\n";

export function isQuickQueryPath(queryPath: string): boolean {
  return path.basename(queryPath) === QUICK_QUERY_QUERY_NAME;
}

async function getQuickQueriesDir(ctx: ExtensionContext): Promise<string> {
  const storagePath = ctx.storagePath;
  if (storagePath === undefined) {
    throw new Error("Workspace storage path is undefined");
  }
  const queriesPath = path.join(storagePath, QUICK_QUERIES_DIR_NAME);
  await fs.ensureDir(queriesPath, { mode: 0o700 });
  return queriesPath;
}

function updateQuickQueryDir(queriesDir: string, index: number, len: number) {
  workspace.updateWorkspaceFolders(index, len, {
    uri: Uri.file(queriesDir),
    name: QUICK_QUERY_WORKSPACE_FOLDER_NAME,
  });
}

function findExistingQuickQueryEditor() {
  return Window.visibleTextEditors.find(
    (editor) =>
      path.basename(editor.document.uri.fsPath) === QUICK_QUERY_QUERY_NAME,
  );
}

/**
 * Show a buffer the user can enter a simple query into.
 */
export async function displayQuickQuery(
  ctx: ExtensionContext,
  cliServer: CodeQLCliServer,
  databaseUI: DatabaseUI,
  progress: ProgressCallback,
  token: CancellationToken,
) {
  try {
    // If there is already a quick query open, don't clobber it, just
    // show it.
    const existing = findExistingQuickQueryEditor();
    if (existing) {
      await Window.showTextDocument(existing.document);
      return;
    }

    const workspaceFolders = workspace.workspaceFolders || [];
    const queriesDir = await getQuickQueriesDir(ctx);

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
      const makeMultiRoot = await showBinaryChoiceDialog(
        "Quick query requires multiple folders in the workspace. Reload workspace as multi-folder workspace?",
      );
      if (makeMultiRoot) {
        updateQuickQueryDir(queriesDir, workspaceFolders.length, 0);
      }
      return;
    }

    const index = workspaceFolders.findIndex(
      (folder) => folder.name === QUICK_QUERY_WORKSPACE_FOLDER_NAME,
    );
    if (index === -1) {
      updateQuickQueryDir(queriesDir, workspaceFolders.length, 0);
    } else {
      updateQuickQueryDir(queriesDir, index, 1);
    }

    // We're going to infer which qlpack to use from the current database
    const dbItem = await databaseUI.getDatabaseItem(progress, token);
    if (dbItem === undefined) {
      throw new Error("Can't start quick query without a selected database");
    }

    const datasetFolder = await dbItem.getDatasetFolder(cliServer);
    const dbscheme = await getPrimaryDbscheme(datasetFolder);
    const qlpack = (await getQlPackForDbscheme(cliServer, dbscheme))
      .dbschemePack;
    const qlPackFile = path.join(queriesDir, "qlpack.yml");
    const qlFile = path.join(queriesDir, QUICK_QUERY_QUERY_NAME);
    const shouldRewrite = await checkShouldRewrite(qlPackFile, qlpack);

    // Only rewrite the qlpack file if the database has changed
    if (shouldRewrite) {
      const quickQueryQlpackYaml: any = {
        name: "vscode/quick-query",
        version: "1.0.0",
        dependencies: {
          [qlpack]: "*",
        },
      };
      await fs.writeFile(
        qlPackFile,
        QLPACK_FILE_HEADER + yaml.dump(quickQueryQlpackYaml),
        "utf8",
      );
    }

    if (shouldRewrite || !(await fs.pathExists(qlFile))) {
      await fs.writeFile(
        qlFile,
        getInitialQueryContents(dbItem.language, dbscheme),
        "utf8",
      );
    }

    if (shouldRewrite) {
      await cliServer.clearCache();
      await cliServer.packInstall(queriesDir, true);
    }

    await Window.showTextDocument(await workspace.openTextDocument(qlFile));
  } catch (e) {
    if (
      e instanceof ResponseError &&
      e.code == LSPErrorCodes.RequestCancelled
    ) {
      throw new UserCancellationException(getErrorMessage(e));
    } else {
      throw e;
    }
  }
}

async function checkShouldRewrite(qlPackFile: string, newDependency: string) {
  if (!(await fs.pathExists(qlPackFile))) {
    return true;
  }
  const qlPackContents: any = yaml.load(await fs.readFile(qlPackFile, "utf8"));
  return !qlPackContents.dependencies?.[newDependency];
}
