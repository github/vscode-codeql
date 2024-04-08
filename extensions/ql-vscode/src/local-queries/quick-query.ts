import { ensureDir, writeFile, pathExists, readFile } from "fs-extra";
import { dump, load } from "js-yaml";
import { basename, join } from "path";
import { window as Window, workspace, Uri } from "vscode";
import { LSPErrorCodes, ResponseError } from "vscode-languageclient";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import type { DatabaseUI } from "../databases/local-databases-ui";
import { getInitialQueryContents } from "./query-contents";
import { getPrimaryDbscheme, getQlPackForDbscheme } from "../databases/qlpack";
import type { ProgressCallback } from "../common/vscode/progress";
import { UserCancellationException } from "../common/vscode/progress";
import { getErrorMessage } from "../common/helpers-pure";
import { FALLBACK_QLPACK_FILENAME, getQlPackFilePath } from "../common/ql";
import type { App } from "../common/app";
import type { ExtensionApp } from "../common/vscode/extension-app";
import type { QlPackFile } from "../packaging/qlpack-file";

const QUICK_QUERIES_DIR_NAME = "quick-queries";
const QUICK_QUERY_QUERY_NAME = "quick-query.ql";
const QUICK_QUERY_WORKSPACE_FOLDER_NAME = "Quick Queries";
const QLPACK_FILE_HEADER = "# This is an automatically generated file.\n\n";

export function isQuickQueryPath(queryPath: string): boolean {
  return basename(queryPath) === QUICK_QUERY_QUERY_NAME;
}

async function getQuickQueriesDir(app: App): Promise<string> {
  const storagePath = app.workspaceStoragePath;
  if (storagePath === undefined) {
    throw new Error("Workspace storage path is undefined");
  }
  const queriesPath = join(storagePath, QUICK_QUERIES_DIR_NAME);
  await ensureDir(queriesPath, { mode: 0o700 });
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
    (editor) => basename(editor.document.uri.fsPath) === QUICK_QUERY_QUERY_NAME,
  );
}

/**
 * Show a buffer the user can enter a simple query into.
 */
export async function displayQuickQuery(
  app: ExtensionApp,
  cliServer: CodeQLCliServer,
  databaseUI: DatabaseUI,
  progress: ProgressCallback,
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
    const queriesDir = await getQuickQueriesDir(app);

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
      const createQueryOption = 'Run "Create query"';
      const quickQueryOption = 'Run "Quick query" anyway';
      const quickQueryPrompt = await Window.showWarningMessage(
        '"Quick query" requires reloading your workspace as a multi-root workspace, which may cause query history and databases to be lost.',
        {
          modal: true,
          detail:
            'The "Create query" command does not require reloading the workspace.',
        },
        createQueryOption,
        quickQueryOption,
      );
      if (quickQueryPrompt === quickQueryOption) {
        updateQuickQueryDir(queriesDir, workspaceFolders.length, 0);
      }
      if (quickQueryPrompt === createQueryOption) {
        await app.queryServerCommands.execute("codeQLQuickQuery.createQuery");
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
    const dbItem = await databaseUI.getDatabaseItem(progress);
    if (dbItem === undefined) {
      throw new Error("Can't start quick query without a selected database");
    }

    const datasetFolder = await dbItem.getDatasetFolder(cliServer);
    const dbscheme = await getPrimaryDbscheme(datasetFolder);
    const qlpack = (await getQlPackForDbscheme(cliServer, dbscheme))
      .dbschemePack;
    const qlPackFile = await getQlPackFilePath(queriesDir);
    const qlFile = join(queriesDir, QUICK_QUERY_QUERY_NAME);
    const shouldRewrite = await checkShouldRewrite(qlPackFile, qlpack);

    // Only rewrite the qlpack file if the database has changed
    if (shouldRewrite) {
      const quickQueryQlpackYaml: QlPackFile = {
        name: "vscode/quick-query",
        version: "1.0.0",
        dependencies: {
          [qlpack]: "*",
        },
      };
      await writeFile(
        qlPackFile ?? join(queriesDir, FALLBACK_QLPACK_FILENAME),
        QLPACK_FILE_HEADER + dump(quickQueryQlpackYaml),
        "utf8",
      );
    }

    if (shouldRewrite || !(await pathExists(qlFile))) {
      await writeFile(
        qlFile,
        getInitialQueryContents(dbItem.language, dbscheme),
        "utf8",
      );
    }

    if (shouldRewrite) {
      await cliServer.clearCache();
      await cliServer.packInstall(queriesDir, { forceUpdate: true });
    }

    await Window.showTextDocument(await workspace.openTextDocument(qlFile));
  } catch (e) {
    if (
      e instanceof ResponseError &&
      e.code === LSPErrorCodes.RequestCancelled
    ) {
      throw new UserCancellationException(getErrorMessage(e));
    } else {
      throw e;
    }
  }
}

async function checkShouldRewrite(
  qlPackFile: string | undefined,
  newDependency: string,
) {
  if (!qlPackFile) {
    return true;
  }
  if (!(await pathExists(qlPackFile))) {
    return true;
  }
  const qlPackContents = load(await readFile(qlPackFile, "utf8")) as QlPackFile;
  return !qlPackContents.dependencies?.[newDependency];
}
