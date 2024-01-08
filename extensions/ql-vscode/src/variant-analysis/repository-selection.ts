import { UserCancellationException } from "../common/vscode/progress";
import type { DbManager } from "../databases/db-manager";
import { DbItemKind } from "../databases/db-item";

export interface RepositorySelection {
  repositories?: string[];
  repositoryLists?: string[];
  owners?: string[];
}

/**
 * Gets the repositories or repository lists to run the query against.
 * @returns The user selection.
 */
export async function getRepositorySelection(
  dbManager: DbManager,
): Promise<RepositorySelection> {
  const selectedDbItem = dbManager.getSelectedDbItem();
  if (selectedDbItem) {
    switch (selectedDbItem.kind) {
      case DbItemKind.RemoteSystemDefinedList:
        return { repositoryLists: [selectedDbItem.listName] };
      case DbItemKind.RemoteUserDefinedList:
        if (selectedDbItem.repos.length === 0) {
          throw new UserCancellationException(
            "The selected repository list is empty. Please add repositories to it before running a variant analysis.",
          );
        } else {
          return {
            repositories: selectedDbItem.repos.map((repo) => repo.repoFullName),
          };
        }
      case DbItemKind.RemoteOwner:
        return { owners: [selectedDbItem.ownerName] };
      case DbItemKind.RemoteRepo:
        return { repositories: [selectedDbItem.repoFullName] };
    }
  }

  throw new UserCancellationException(
    "Please select a remote database to run the query against.",
  );
}

/**
 * Checks if the selection is valid or not.
 * @param repoSelection The selection to check.
 * @returns A boolean flag indicating if the selection is valid or not.
 */
export function isValidSelection(repoSelection: RepositorySelection): boolean {
  const repositories = repoSelection.repositories || [];
  const repositoryLists = repoSelection.repositoryLists || [];
  const owners = repoSelection.owners || [];

  return (
    repositories.length > 0 || repositoryLists.length > 0 || owners.length > 0
  );
}
