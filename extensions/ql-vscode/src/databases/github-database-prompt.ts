import { window } from "vscode";
import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { Octokit } from "@octokit/rest";
import { showNeverAskAgainDialog } from "../common/vscode/dialog";
import { getLanguageDisplayName } from "../common/query-language";
import {
  downloadGitHubDatabaseFromUrl,
  promptForLanguage,
} from "./database-fetcher";
import { withProgress } from "../common/vscode/progress";
import { DatabaseManager } from "./local-databases";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { AppCommandManager } from "../common/commands";
import { GitHubDatabaseConfig } from "../config";

export type CodeqlDatabase =
  RestEndpointMethodTypes["codeScanning"]["listCodeqlDatabases"]["response"]["data"][number];

export async function findGitHubDatabasesForRepository(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<CodeqlDatabase[]> {
  const response = await octokit.rest.codeScanning.listCodeqlDatabases({
    owner,
    repo,
  });

  return response.data;
}

/**
 * Prompt the user to download a database from GitHub and download that database.
 */
export async function promptAndDownloadGitHubDatabase(
  octokit: Octokit,
  owner: string,
  repo: string,
  databases: CodeqlDatabase[],
  config: GitHubDatabaseConfig,
  databaseManager: DatabaseManager,
  storagePath: string,
  cliServer: CodeQLCliServer,
  commandManager: AppCommandManager,
): Promise<void> {
  const languages = databases.map((database) => database.language);

  const message =
    databases.length === 1
      ? `This repository has an origin (GitHub) that has a ${getLanguageDisplayName(
          languages[0],
        )} CodeQL database. Connect to GitHub and download the existing database?`
      : `This repository has an origin (GitHub) that has ${joinLanguages(
          languages,
        )} CodeQL databases. Connect to GitHub and download any existing databases?`;

  const answer = await showNeverAskAgainDialog(
    message,
    false,
    "Connect",
    "Not now",
    "Never",
  );

  if (answer === "Not now" || answer === undefined) {
    return;
  }

  if (answer === "Never") {
    await config.setDownload("never");
    return;
  }

  const language = await promptForLanguage(languages, undefined);
  if (!language) {
    return;
  }

  const database = databases.find((database) => database.language === language);
  if (!database) {
    return;
  }

  await withProgress(async (progress) => {
    await downloadGitHubDatabaseFromUrl(
      database.url,
      database.id,
      database.created_at,
      database.commit_oid ?? null,
      owner,
      repo,
      octokit,
      progress,
      databaseManager,
      storagePath,
      cliServer,
      true,
      false,
    );

    await commandManager.execute("codeQLDatabases.focus");
    void window.showInformationMessage(
      `Downloaded ${getLanguageDisplayName(language)} database from GitHub.`,
    );
  });
}

/**
 * Join languages into a string for display. Will automatically add `,` and `and` as appropriate.
 *
 * @param languages The languages to join. These should be language identifiers, such as `csharp`.
 */
function joinLanguages(languages: string[]): string {
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
