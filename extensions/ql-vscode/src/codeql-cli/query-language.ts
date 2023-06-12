import { CodeQLCliServer } from "./cli";
import { Uri, window } from "vscode";
import { isQueryLanguage, QueryLanguage } from "../common/query-language";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { extLogger } from "../common";
import { UserCancellationException } from "../common/vscode/progress";
import { showAndLogErrorMessage } from "../common/vscode/log";

/**
 * Finds the language that a query targets.
 * If it can't be autodetected, prompt the user to specify the language manually.
 */
export async function findLanguage(
  cliServer: CodeQLCliServer,
  queryUri: Uri | undefined,
): Promise<QueryLanguage | undefined> {
  const uri = queryUri || window.activeTextEditor?.document.uri;
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
  const language = await window.showQuickPick(
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
        extLogger,
        "Language not found. Language must be specified manually.",
      );
    }
    return undefined;
  }

  if (!isQueryLanguage(language)) {
    void showAndLogErrorMessage(
      extLogger,
      `Language '${language}' is not supported. Only languages ${Object.values(
        QueryLanguage,
      ).join(", ")} are supported.`,
    );
    return undefined;
  }

  return language;
}
