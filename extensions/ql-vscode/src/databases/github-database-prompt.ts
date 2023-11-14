import { window } from "vscode";
import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { Octokit } from "@octokit/rest";
import { showNeverAskAgainDialog } from "../common/vscode/dialog";
import { getLanguageDisplayName } from "../common/query-language";
import { downloadGitHubDatabaseFromUrl } from "./database-fetcher";
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
 * Prompt the user to download a database from GitHub. This is a blocking method, so this should
 * almost never be called with `await`.
 */
export async function promptGitHubDatabaseDownload(
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

  const databasesMessage =
    databases.length === 1
      ? `This repository has an origin (GitHub) that has a ${getLanguageDisplayName(
          languages[0],
        )} CodeQL database.`
      : `This repository has an origin (GitHub) that has ${joinLanguages(
          languages,
        )} CodeQL databases.`;

  const connectMessage =
    databases.length === 1
      ? `Connect to GitHub and download the existing database?`
      : `Connect to GitHub and download any existing databases?`;

  const answer = await showNeverAskAgainDialog(
    `${databasesMessage} ${connectMessage}`,
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

  const selectedDatabases = await promptForDatabases(databases);
  if (selectedDatabases.length === 0) {
    return;
  }

  await Promise.all(
    selectedDatabases.map((database) =>
      withProgress(
        async (progress) => {
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

async function promptForDatabases(
  databases: CodeqlDatabase[],
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
    title: "Select databases to download",
    placeHolder: "Databases found in this repository",
    ignoreFocusOut: true,
    canPickMany: true,
  });

  return selectedItems?.map((selectedItem) => selectedItem.database) ?? [];
}
