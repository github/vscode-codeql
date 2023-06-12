import {
  ensureDirSync,
  pathExists,
  ensureDir,
  writeFile,
  opendir,
} from "fs-extra";
import { glob } from "glob";
import { join, basename, dirname } from "path";
import { dirSync } from "tmp-promise";
import { Uri, window as Window, workspace, env, WorkspaceFolder } from "vscode";
import { CodeQLCliServer } from "./codeql-cli/cli";
import { UserCancellationException } from "./common/vscode/progress";
import { extLogger, OutputChannelLogger } from "./common";
import { QueryMetadata } from "./pure/interface-types";
import { telemetryListener } from "./telemetry";
import { RedactableError } from "./pure/errors";
import { dbSchemeToLanguage, QueryLanguage } from "./common/query-language";
import { isCodespacesTemplate } from "./config";
import { AppCommandManager } from "./common/commands";

// Shared temporary folder for the extension.
export const tmpDir = dirSync({
  prefix: "queries_",
  keep: false,
  unsafeCleanup: true,
});
export const upgradesTmpDir = join(tmpDir.name, "upgrades");
ensureDirSync(upgradesTmpDir);

export const tmpDirDisposal = {
  dispose: () => {
    try {
      tmpDir.removeCallback();
    } catch (e) {
      void extLogger.log(
        `Failed to remove temporary directory ${tmpDir.name}: ${e}`,
      );
    }
  },
};

interface ShowAndLogExceptionOptions extends ShowAndLogOptions {
  /** Custom properties to include in the telemetry report. */
  extraTelemetryProperties?: { [key: string]: string };
}

interface ShowAndLogOptions {
  /** The output logger that will receive the message. */
  outputLogger?: OutputChannelLogger;
  /** A set of items that will be rendered as actions in the message. */
  items?: string[];
  /**
   * An alternate message that is added to the log, but not displayed in the popup.
   * This is useful for adding extra detail to the logs that would be too noisy for the popup.
   */
  fullMessage?: string;
}

/**
 * Show an error message, log it to the console, and emit redacted information as telemetry
 *
 * @param error The error to show. Only redacted information will be included in the telemetry.
 * @param options See individual fields on `ShowAndLogExceptionOptions` type.
 *
 * @return A promise that resolves to the selected item or undefined when being dismissed.
 */
export async function showAndLogExceptionWithTelemetry(
  error: RedactableError,
  options: ShowAndLogExceptionOptions = {},
): Promise<string | undefined> {
  telemetryListener?.sendError(error, options.extraTelemetryProperties);
  return showAndLogErrorMessage(error.fullMessage, options);
}

/**
 * Show an error message and log it to the console
 *
 * @param message The message to show.
 * @param options See individual fields on `ShowAndLogOptions` type.
 *
 * @return A promise that resolves to the selected item or undefined when being dismissed.
 */
export async function showAndLogErrorMessage(
  message: string,
  options?: ShowAndLogOptions,
): Promise<string | undefined> {
  return internalShowAndLog(
    dropLinesExceptInitial(message),
    Window.showErrorMessage,
    { fullMessage: message, ...options },
  );
}

function dropLinesExceptInitial(message: string, n = 2) {
  return message.toString().split(/\r?\n/).slice(0, n).join("\n");
}

/**
 * Show a warning message and log it to the console
 *
 * @param message The message to show.
 * @param options See individual fields on `ShowAndLogOptions` type.
 *
 * @return A promise that resolves to the selected item or undefined when being dismissed.
 */
export async function showAndLogWarningMessage(
  message: string,
  options?: ShowAndLogOptions,
): Promise<string | undefined> {
  return internalShowAndLog(message, Window.showWarningMessage, options);
}

/**
 * Show an information message and log it to the console
 *
 * @param message The message to show.
 * @param options See individual fields on `ShowAndLogOptions` type.
 *
 * @return A promise that resolves to the selected item or undefined when being dismissed.
 */
export async function showAndLogInformationMessage(
  message: string,
  options?: ShowAndLogOptions,
): Promise<string | undefined> {
  return internalShowAndLog(message, Window.showInformationMessage, options);
}

type ShowMessageFn = (
  message: string,
  ...items: string[]
) => Thenable<string | undefined>;

async function internalShowAndLog(
  message: string,
  fn: ShowMessageFn,
  { items = [], outputLogger = extLogger, fullMessage }: ShowAndLogOptions = {},
): Promise<string | undefined> {
  const label = "Show Log";
  void outputLogger.log(fullMessage || message);
  const result = await fn(message, label, ...items);
  if (result === label) {
    outputLogger.show();
  }
  return result;
}

/**
 * Opens a modal dialog for the user to make a yes/no choice.
 *
 * @param message The message to show.
 * @param modal If true (the default), show a modal dialog box, otherwise dialog is non-modal and can
 *        be closed even if the user does not make a choice.
 * @param yesTitle The text in the box indicating the affirmative choice.
 * @param noTitle The text in the box indicating the negative choice.
 *
 * @return
 *  `true` if the user clicks 'Yes',
 *  `false` if the user clicks 'No' or cancels the dialog,
 *  `undefined` if the dialog is closed without the user making a choice.
 */
export async function showBinaryChoiceDialog(
  message: string,
  modal = true,
  yesTitle = "Yes",
  noTitle = "No",
): Promise<boolean | undefined> {
  const yesItem = { title: yesTitle, isCloseAffordance: false };
  const noItem = { title: noTitle, isCloseAffordance: true };
  const chosenItem = await Window.showInformationMessage(
    message,
    { modal },
    yesItem,
    noItem,
  );
  if (!chosenItem) {
    return undefined;
  }
  return chosenItem?.title === yesItem.title;
}

/**
 * Opens a modal dialog for the user to make a yes/no choice.
 *
 * @param message The message to show.
 * @param modal If true (the default), show a modal dialog box, otherwise dialog is non-modal and can
 *        be closed even if the user does not make a choice.
 *
 * @return
 *  `true` if the user clicks 'Yes',
 *  `false` if the user clicks 'No' or cancels the dialog,
 *  `undefined` if the dialog is closed without the user making a choice.
 */
export async function showBinaryChoiceWithUrlDialog(
  message: string,
  url: string,
): Promise<boolean | undefined> {
  const urlItem = { title: "More Information", isCloseAffordance: false };
  const yesItem = { title: "Yes", isCloseAffordance: false };
  const noItem = { title: "No", isCloseAffordance: true };
  let chosenItem;

  // Keep the dialog open as long as the user is clicking the 'more information' option.
  // To prevent an infinite loop, if the user clicks 'more information' 5 times, close the dialog and return cancelled
  let count = 0;
  do {
    chosenItem = await Window.showInformationMessage(
      message,
      { modal: true },
      urlItem,
      yesItem,
      noItem,
    );
    if (chosenItem === urlItem) {
      await env.openExternal(Uri.parse(url, true));
    }
    count++;
  } while (chosenItem === urlItem && count < 5);

  if (!chosenItem || chosenItem.title === urlItem.title) {
    return undefined;
  }
  return chosenItem.title === yesItem.title;
}

/**
 * Show an information message with a customisable action.
 * @param message The message to show.
 * @param actionMessage The call to action message.
 *
 * @return `true` if the user clicks the action, `false` if the user cancels the dialog.
 */
export async function showInformationMessageWithAction(
  message: string,
  actionMessage: string,
): Promise<boolean> {
  const actionItem = { title: actionMessage, isCloseAffordance: false };
  const chosenItem = await Window.showInformationMessage(message, actionItem);
  return chosenItem === actionItem;
}

/** Returns true if the specified workspace folder is on the file system. */
export function isWorkspaceFolderOnDisk(
  workspaceFolder: WorkspaceFolder,
): boolean {
  return workspaceFolder.uri.scheme === "file";
}

/**
 * Opens a modal dialog for the user to make a choice between yes/no/never be asked again.
 *
 * @param message The message to show.
 * @param modal If true (the default), show a modal dialog box, otherwise dialog is non-modal and can
 *        be closed even if the user does not make a choice.
 * @param yesTitle The text in the box indicating the affirmative choice.
 * @param noTitle The text in the box indicating the negative choice.
 * @param neverTitle The text in the box indicating the opt out choice.
 *
 * @return
 *  `Yes` if the user clicks 'Yes',
 *  `No` if the user clicks 'No' or cancels the dialog,
 *  `No, and never ask me again` if the user clicks 'No, and never ask me again',
 *  `undefined` if the dialog is closed without the user making a choice.
 */
export async function showNeverAskAgainDialog(
  message: string,
  modal = true,
  yesTitle = "Yes",
  noTitle = "No",
  neverAskAgainTitle = "No, and never ask me again",
): Promise<string | undefined> {
  const yesItem = { title: yesTitle, isCloseAffordance: true };
  const noItem = { title: noTitle, isCloseAffordance: false };
  const neverAskAgainItem = {
    title: neverAskAgainTitle,
    isCloseAffordance: false,
  };
  const chosenItem = await Window.showInformationMessage(
    message,
    { modal },
    yesItem,
    noItem,
    neverAskAgainItem,
  );

  return chosenItem?.title;
}

/** Gets all active workspace folders that are on the filesystem. */
export function getOnDiskWorkspaceFoldersObjects() {
  const workspaceFolders = workspace.workspaceFolders ?? [];
  return workspaceFolders.filter(isWorkspaceFolderOnDisk);
}

/** Gets all active workspace folders that are on the filesystem. */
export function getOnDiskWorkspaceFolders() {
  return getOnDiskWorkspaceFoldersObjects().map((folder) => folder.uri.fsPath);
}

/** Check if folder is already present in workspace */
export function isFolderAlreadyInWorkspace(folderName: string) {
  const workspaceFolders = workspace.workspaceFolders || [];

  return !!workspaceFolders.find(
    (workspaceFolder) => workspaceFolder.name === folderName,
  );
}

/** Check if the current workspace is the CodeTour and open the workspace folder.
 * Without this, we can't run the code tour correctly.
 **/
export async function prepareCodeTour(
  commandManager: AppCommandManager,
): Promise<void> {
  if (workspace.workspaceFolders?.length) {
    const currentFolder = workspace.workspaceFolders[0].uri.fsPath;

    const tutorialWorkspacePath = join(
      currentFolder,
      "tutorial.code-workspace",
    );
    const toursFolderPath = join(currentFolder, ".tours");

    /** We're opening the tutorial workspace, if we detect it.
     * This will only happen if the following three conditions are met:
     * - the .tours folder exists
     * - the tutorial.code-workspace file exists
     * - the CODESPACES_TEMPLATE setting doesn't exist (it's only set if the user has already opened
     * the tutorial workspace so it's a good indicator that the user is in the folder but has ignored
     * the prompt to open the workspace)
     */
    if (
      (await pathExists(tutorialWorkspacePath)) &&
      (await pathExists(toursFolderPath)) &&
      !isCodespacesTemplate()
    ) {
      const answer = await showBinaryChoiceDialog(
        "We've detected you're in the CodeQL Tour repo. We will need to open the workspace file to continue. Reload?",
      );

      if (!answer) {
        return;
      }

      const tutorialWorkspaceUri = Uri.file(tutorialWorkspacePath);

      void extLogger.log(
        `In prepareCodeTour() method, going to open the tutorial workspace file: ${tutorialWorkspacePath}`,
      );

      await commandManager.execute("vscode.openFolder", tutorialWorkspaceUri);
    }
  }
}

/**
 * The following functions al heuristically determine metadata about databases.
 */

/**
 * Returns the initial contents for an empty query, based on the language of the selected
 * databse.
 *
 * First try to use the given language name. If that doesn't exist, try to infer it based on
 * dbscheme. Otherwise return no import statement.
 *
 * @param language the database language or empty string if unknown
 * @param dbscheme path to the dbscheme file
 *
 * @returns an import and empty select statement appropriate for the selected language
 */
export function getInitialQueryContents(language: string, dbscheme: string) {
  if (!language) {
    const dbschemeBase = basename(dbscheme) as keyof typeof dbSchemeToLanguage;
    language = dbSchemeToLanguage[dbschemeBase];
  }

  return language ? `import ${language}\n\nselect ""` : 'select ""';
}

/**
 * Heuristically determines if the directory passed in corresponds
 * to a database root. A database root is a directory that contains
 * a codeql-database.yml or (historically) a .dbinfo file. It also
 * contains a folder starting with `db-`.
 */
export async function isLikelyDatabaseRoot(maybeRoot: string) {
  const [a, b, c] = await Promise.all([
    // databases can have either .dbinfo or codeql-database.yml.
    pathExists(join(maybeRoot, ".dbinfo")),
    pathExists(join(maybeRoot, "codeql-database.yml")),

    // they *must* have a db-{language} folder
    glob("db-*/", { cwd: maybeRoot }),
  ]);

  return (a || b) && c.length > 0;
}

/**
 * A language folder is any folder starting with `db-` that is itself not a database root.
 */
export async function isLikelyDbLanguageFolder(dbPath: string) {
  return (
    basename(dbPath).startsWith("db-") && !(await isLikelyDatabaseRoot(dbPath))
  );
}

export function isQueryLanguage(language: string): language is QueryLanguage {
  return Object.values(QueryLanguage).includes(language as QueryLanguage);
}

/**
 * Finds the language that a query targets.
 * If it can't be autodetected, prompt the user to specify the language manually.
 */
export async function findLanguage(
  cliServer: CodeQLCliServer,
  queryUri: Uri | undefined,
): Promise<QueryLanguage | undefined> {
  const uri = queryUri || Window.activeTextEditor?.document.uri;
  if (uri !== undefined) {
    try {
      const queryInfo = await cliServer.resolveQueryByLanguage(
        getOnDiskWorkspaceFolders(),
        uri,
      );
      const language = Object.keys(queryInfo.byLanguage)[0];
      void extLogger.log(`Detected query language: ${language}`);

      if (isQueryLanguage(language)) {
        return language;
      }

      void extLogger.log(
        "Query language is unsupported. Select language manually.",
      );
    } catch (e) {
      void extLogger.log(
        "Could not autodetect query language. Select language manually.",
      );
    }
  }

  // will be undefined if user cancels the quick pick.
  return await askForLanguage(cliServer, false);
}

export async function askForLanguage(
  cliServer: CodeQLCliServer,
  throwOnEmpty = true,
): Promise<QueryLanguage | undefined> {
  const language = await Window.showQuickPick(
    await cliServer.getSupportedLanguages(),
    {
      placeHolder: "Select target language for your query",
      ignoreFocusOut: true,
    },
  );
  if (!language) {
    // This only happens if the user cancels the quick pick.
    if (throwOnEmpty) {
      throw new UserCancellationException("Cancelled.");
    } else {
      void showAndLogErrorMessage(
        "Language not found. Language must be specified manually.",
      );
    }
    return undefined;
  }

  if (!isQueryLanguage(language)) {
    void showAndLogErrorMessage(
      `Language '${language}' is not supported. Only languages ${Object.values(
        QueryLanguage,
      ).join(", ")} are supported.`,
    );
    return undefined;
  }

  return language;
}

/**
 * Gets metadata for a query, if it exists.
 * @param cliServer The CLI server.
 * @param queryPath The path to the query.
 * @returns A promise that resolves to the query metadata, if available.
 */
export async function tryGetQueryMetadata(
  cliServer: CodeQLCliServer,
  queryPath: string,
): Promise<QueryMetadata | undefined> {
  try {
    return await cliServer.resolveMetadata(queryPath);
  } catch (e) {
    // Ignore errors and provide no metadata.
    void extLogger.log(`Couldn't resolve metadata for ${queryPath}: ${e}`);
    return;
  }
}

/**
 * Creates a file in the query directory that indicates when this query was created.
 * This is important for keeping track of when queries should be removed.
 *
 * @param queryPath The directory that will contain all files relevant to a query result.
 * It does not need to exist.
 */
export async function createTimestampFile(storagePath: string) {
  const timestampPath = join(storagePath, "timestamp");
  await ensureDir(storagePath);
  await writeFile(timestampPath, Date.now().toString(), "utf8");
}

/**
 * Recursively walk a directory and return the full path to all files found.
 * Symbolic links are ignored.
 *
 * @param dir the directory to walk
 *
 * @return An iterator of the full path to all files recursively found in the directory.
 */
export async function* walkDirectory(
  dir: string,
): AsyncIterableIterator<string> {
  const seenFiles = new Set<string>();
  for await (const d of await opendir(dir)) {
    const entry = join(dir, d.name);
    seenFiles.add(entry);
    if (d.isDirectory()) {
      yield* walkDirectory(entry);
    } else if (d.isFile()) {
      yield entry;
    }
  }
}

/**
 * Returns the path of the first folder in the workspace.
 * This is used to decide where to create skeleton QL packs.
 *
 * If the first folder is a QL pack, then the parent folder is returned.
 * This is because the vscode-codeql-starter repo contains a ql pack in
 * the first folder.
 *
 * This is a temporary workaround until we can retire the
 * vscode-codeql-starter repo.
 */

export function getFirstWorkspaceFolder() {
  const workspaceFolders = getOnDiskWorkspaceFolders();

  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error("No workspace folders found");
  }

  const firstFolderFsPath = workspaceFolders[0];

  // For the vscode-codeql-starter repo, the first folder will be a ql pack
  // so we need to get the parent folder
  if (
    firstFolderFsPath.includes(
      join("vscode-codeql-starter", "codeql-custom-queries"),
    )
  ) {
    // return the parent folder
    return dirname(firstFolderFsPath);
  } else {
    // if the first folder is not a ql pack, then we are in a normal workspace
    return firstFolderFsPath;
  }
}
