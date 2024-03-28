import type { CodeqlDatabase } from "./api";
import type { DatabaseItem, DatabaseManager } from "../local-databases";
import type { Octokit } from "@octokit/rest";
import type { AppCommandManager } from "../../common/commands";
import { getLanguageDisplayName } from "../../common/query-language";
import { showNeverAskAgainDialog } from "../../common/vscode/dialog";
import type { DatabaseFetcher } from "../database-fetcher";
import { withProgress } from "../../common/vscode/progress";
import { window } from "vscode";
import type { GitHubDatabaseConfig } from "../../config";
import { joinLanguages, promptForDatabases } from "./download";

export type DatabaseUpdate = {
  database: CodeqlDatabase;
  databaseItem: DatabaseItem;
};

type DatabaseUpdateStatusUpdateAvailable = {
  type: "updateAvailable";
  databaseUpdates: DatabaseUpdate[];
};

type DatabaseUpdateStatusUpToDate = {
  type: "upToDate";
};

type DatabaseUpdateStatusNoDatabase = {
  type: "noDatabase";
};

type DatabaseUpdateStatus =
  | DatabaseUpdateStatusUpdateAvailable
  | DatabaseUpdateStatusUpToDate
  | DatabaseUpdateStatusNoDatabase;

/**
 * Check whether a newer database is available for the given repository. Databases are considered updated if:
 * - They have a different commit OID, or
 * - They have the same commit OID, but the remote database was created after the local database.
 */
export function isNewerDatabaseAvailable(
  databases: CodeqlDatabase[],
  owner: string,
  name: string,
  databaseManager: DatabaseManager,
): DatabaseUpdateStatus {
  // Sorted by date added ascending
  const existingDatabasesForRepository = databaseManager.databaseItems
    .filter(
      (db) =>
        db.origin?.type === "github" &&
        db.origin.repository === `${owner}/${name}`,
    )
    .sort((a, b) => (a.dateAdded ?? 0) - (b.dateAdded ?? 0));

  if (existingDatabasesForRepository.length === 0) {
    return {
      type: "noDatabase",
    };
  }

  // Sort order is guaranteed by the sort call above. The newest database is the last one.
  const newestExistingDatabasesByLanguage = new Map<string, DatabaseItem>();
  for (const existingDatabase of existingDatabasesForRepository) {
    newestExistingDatabasesByLanguage.set(
      existingDatabase.language,
      existingDatabase,
    );
  }

  const databaseUpdates = Array.from(newestExistingDatabasesByLanguage.values())
    .map((newestExistingDatabase): DatabaseUpdate | null => {
      const origin = newestExistingDatabase.origin;
      if (origin?.type !== "github") {
        return null;
      }

      const matchingDatabase = databases.find(
        (db) => db.language === newestExistingDatabase.language,
      );
      if (!matchingDatabase) {
        return null;
      }

      // If they are not equal, we assume that the remote database is newer.
      if (matchingDatabase.commit_oid === origin.commitOid) {
        const remoteDatabaseCreatedAt = new Date(matchingDatabase.created_at);
        const localDatabaseCreatedAt = new Date(origin.databaseCreatedAt);

        // If the remote database was created before the local database,
        // we assume that the local database is newer.
        if (remoteDatabaseCreatedAt <= localDatabaseCreatedAt) {
          return null;
        }
      }

      return {
        database: matchingDatabase,
        databaseItem: newestExistingDatabase,
      };
    })
    .filter((update): update is DatabaseUpdate => update !== null)
    .sort((a, b) => a.database.language.localeCompare(b.database.language));

  if (databaseUpdates.length === 0) {
    return {
      type: "upToDate",
    };
  }

  return {
    type: "updateAvailable",
    databaseUpdates,
  };
}

export async function askForGitHubDatabaseUpdate(
  updates: DatabaseUpdate[],
  config: GitHubDatabaseConfig,
): Promise<boolean> {
  const languages = updates.map((update) => update.database.language);

  const message =
    updates.length === 1
      ? `There is a newer ${getLanguageDisplayName(
          languages[0],
        )} CodeQL database available for this repository. Download the database update from GitHub?`
      : `There are newer ${joinLanguages(
          languages,
        )} CodeQL databases available for this repository. Download the database updates from GitHub?`;

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
    await config.setUpdate("never");
    return false;
  }

  return true;
}

export async function downloadDatabaseUpdateFromGitHub(
  octokit: Octokit,
  owner: string,
  repo: string,
  updates: DatabaseUpdate[],
  databaseManager: DatabaseManager,
  databaseFetcher: DatabaseFetcher,
  commandManager: AppCommandManager,
): Promise<void> {
  const selectedDatabases = await promptForDatabases(
    updates.map((update) => update.database),
    {
      title: "Select databases to update",
    },
  );
  if (selectedDatabases.length === 0) {
    return;
  }

  await Promise.all(
    selectedDatabases.map((database) => {
      const update = updates.find((update) => update.database === database);
      if (!update) {
        return;
      }

      return withProgress(
        async (progress) => {
          const newDatabase =
            await databaseFetcher.downloadGitHubDatabaseFromUrl(
              database.url,
              database.id,
              database.created_at,
              database.commit_oid ?? null,
              owner,
              repo,
              octokit,
              progress,
              databaseManager.currentDatabaseItem === update.databaseItem,
              update.databaseItem.hasSourceArchiveInExplorer(),
            );
          if (newDatabase === undefined) {
            return;
          }

          await databaseManager.removeDatabaseItem(update.databaseItem);

          await commandManager.execute("codeQLDatabases.focus");
          void window.showInformationMessage(
            `Updated ${getLanguageDisplayName(
              database.language,
            )} database from GitHub.`,
          );
        },
        {
          title: `Updating ${getLanguageDisplayName(
            database.language,
          )} database from GitHub`,
        },
      );
    }),
  );
}
