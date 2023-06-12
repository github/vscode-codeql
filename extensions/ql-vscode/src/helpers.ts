import { ensureDirSync, pathExists, ensureDir, writeFile } from "fs-extra";
import { join } from "path";
import { dirSync } from "tmp-promise";
import { Uri, window as Window, workspace } from "vscode";
import { CodeQLCliServer } from "./codeql-cli/cli";
import { UserCancellationException } from "./common/vscode/progress";
import { extLogger, OutputChannelLogger } from "./common";
import { QueryMetadata } from "./pure/interface-types";
import { telemetryListener } from "./telemetry";
import { RedactableError } from "./pure/errors";
import { isQueryLanguage, QueryLanguage } from "./common/query-language";
import { isCodespacesTemplate } from "./config";
import { AppCommandManager } from "./common/commands";
import { getOnDiskWorkspaceFolders } from "./common/vscode/workspace-folders";
import { showBinaryChoiceDialog } from "./common/vscode/dialog";

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
