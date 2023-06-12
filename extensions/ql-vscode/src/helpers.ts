import { ensureDir, ensureDirSync, writeFile } from "fs-extra";
import { join } from "path";
import { dirSync } from "tmp-promise";
import { Uri, window as Window } from "vscode";
import { CodeQLCliServer } from "./codeql-cli/cli";
import { UserCancellationException } from "./common/vscode/progress";
import { extLogger } from "./common";
import { isQueryLanguage, QueryLanguage } from "./common/query-language";
import { getOnDiskWorkspaceFolders } from "./common/vscode/workspace-folders";
import { showAndLogErrorMessage } from "./common/vscode/log";

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
