import { window } from "vscode";
import type { Octokit } from "@octokit/rest";
import { showNeverAskAgainDialog } from "../../common/vscode/dialog";
import { getLanguageDisplayName } from "../../common/query-language";
import type { DatabaseFetcher } from "../database-fetcher";
import { withProgress } from "../../common/vscode/progress";
import type { AppCommandManager } from "../../common/commands";
import type { GitHubDatabaseConfig } from "../../config";
import type { CodeqlDatabase } from "./api";

/**
 * Ask whether the user wants to download a database from GitHub.
 * @return true if the user wants to download a database, false otherwise.
 */
export async function askForGitHubDatabaseDownload(
  databases: CodeqlDatabase[],
  config: GitHubDatabaseConfig,
): Promise<boolean> {
  const languages = databases.map((database) => database.language);

  const message =
    databases.length === 1
      ? `This repository has an origin (GitHub) that has a ${getLanguageDisplayName(
          languages[0],
        )} CodeQL database. Download the existing database from GitHub?`
      : `This repository has an origin (GitHub) that has ${joinLanguages(
          languages,
        )} CodeQL databases. Download any existing databases from GitHub?`;

  const answer = await showNeverAskAgainDialog(
    message,
    false,
    "Download",
    "Not now",
    "Never",
  );

  if (answer === "Not now" || answer === undefined) {
    return false;
  }

  if (answer === "Never") {
    await config.setDownload("never");
    return false;
  }

  return true;
}

/**
 * Download a database from GitHub by asking the user for a language and then
 * downloading the database for that language.
 */
export async function downloadDatabaseFromGitHub(
  octokit: Octokit,
  owner: string,
  repo: string,
  databases: CodeqlDatabase[],
  databaseFetcher: DatabaseFetcher,
  commandManager: AppCommandManager,
): Promise<void> {
  const selectedDatabases = await promptForDatabases(databases);
  if (selectedDatabases.length === 0) {
    return;
  }

  await Promise.all(
    selectedDatabases.map((database) =>
      withProgress(
        async (progress) => {
          await databaseFetcher.downloadGitHubDatabaseFromUrl(
            database.url,
            database.id,
            database.created_at,
            database.commit_oid ?? null,
            owner,
            repo,
            octokit,
            progress,
            true,
            false,
          );

          await commandManager.execute("codeQLDatabases.focus");
          void window.showInformationMessage(
            `Downloaded ${getLanguageDisplayName(
              database.language,
            )} database from GitHub.`,
          );
        },
        {
          title: `Adding ${getLanguageDisplayName(
            database.language,
          )} database from GitHub`,
        },
      ),
    ),
  );
}

/**
 * Join languages into a string for display. Will automatically add `,` and `and` as appropriate.
 *
 * @param languages The languages to join. These should be language identifiers, such as `csharp`.
 */
export function joinLanguages(languages: string[]): string {
  const languageDisplayNames = languages
    .map((language) => getLanguageDisplayName(language))
    .sort();

  let result = "";
  for (let i = 0; i < languageDisplayNames.length; i++) {
    if (i > 0) {
      if (i === languageDisplayNames.length - 1) {
        result += " and ";
      } else {
        result += ", ";
      }
    }
    result += languageDisplayNames[i];
  }

  return result;
}

type PromptForDatabasesOptions = {
  title?: string;
  placeHolder?: string;
};

export async function promptForDatabases(
  databases: CodeqlDatabase[],
  {
    title = "Select databases to download",
    placeHolder = "Databases found in this repository",
  }: PromptForDatabasesOptions = {},
): Promise<CodeqlDatabase[]> {
  if (databases.length === 1) {
    return databases;
  }

  const items = databases
    .map((database) => {
      const bytesToDisplayMB = `${(database.size / (1024 * 1024)).toFixed(
        1,
      )} MB`;

      return {
        label: getLanguageDisplayName(database.language),
        description: bytesToDisplayMB,
        database,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  const selectedItems = await window.showQuickPick(items, {
    title,
    placeHolder,
    ignoreFocusOut: true,
    canPickMany: true,
  });

  return selectedItems?.map((selectedItem) => selectedItem.database) ?? [];
}
