import type { CodeQLCliServer } from "./cli";
import type { CancellationToken, Uri } from "vscode";
import { window } from "vscode";
import {
  getLanguageDisplayName,
  isQueryLanguage,
  QueryLanguage,
} from "../common/query-language";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { extLogger } from "../common/logging/vscode";
import { UserCancellationException } from "../common/vscode/progress";
import { showAndLogErrorMessage } from "../common/logging";

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
    } catch {
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
  token?: CancellationToken,
): Promise<QueryLanguage | undefined> {
  const supportedLanguages = await cliServer.getSupportedLanguages();

  const items = supportedLanguages
    .filter((language) => isQueryLanguage(language))
    .map((language) => ({
      label: getLanguageDisplayName(language),
      description: language,
      language,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const selectedItem = await window.showQuickPick(
    items,
    {
      placeHolder: "Select target query language",
      ignoreFocusOut: true,
    },
    token,
  );
  if (!selectedItem) {
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

  const language = selectedItem.language;

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
