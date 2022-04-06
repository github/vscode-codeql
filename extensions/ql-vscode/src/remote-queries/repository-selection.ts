import { QuickPickItem, window } from 'vscode';
import { showAndLogErrorMessage } from '../helpers';
import { logger } from '../logging';
import { getRemoteRepositoryLists } from '../config';
import { REPO_REGEX } from '../pure/helpers-pure';

export interface RepositorySelection {
  repositories?: string[];
  repositoryLists?: string[]
}

interface RepoListQuickPickItem extends QuickPickItem {
  repositories?: string[];
  repositoryList?: string;
  useCustomRepository?: boolean;
}

/**
 * Gets the repositories or repository lists to run the query against.
 * @returns The user selection.
 */
export async function getRepositorySelection(): Promise<RepositorySelection> {
  const quickPickItems = [
    createCustomRepoQuickPickItem(),
    ...createSystemDefinedRepoListsQuickPickItems(),
    ...createUserDefinedRepoListsQuickPickItems(),
  ];

  const options = {
    placeHolder: 'Select a repository list. You can define repository lists in the `codeQL.variantAnalysis.repositoryLists` setting.',
    ignoreFocusOut: true,
  };

  const quickpick = await window.showQuickPick<RepoListQuickPickItem>(
    quickPickItems,
    options);

  if (quickpick?.repositories?.length) {
    void logger.log(`Selected repositories: ${quickpick.repositories.join(', ')}`);
    return { repositories: quickpick.repositories };
  } else if (quickpick?.repositoryList) {
    void logger.log(`Selected repository list: ${quickpick.repositoryList}`);
    return { repositoryLists: [quickpick.repositoryList] };
  } else if (quickpick?.useCustomRepository) {
    const customRepo = await getCustomRepo();
    if (!customRepo || !REPO_REGEX.test(customRepo)) {
      void showAndLogErrorMessage('Invalid repository format. Please enter a valid repository in the format <owner>/<repo> (e.g. github/codeql)');
      return {};
    }
    void logger.log(`Entered repository: ${customRepo}`);
    return { repositories: [customRepo] };
  } else {
    void showAndLogErrorMessage('No repositories selected.');
    return {};
  }
}

/**
 * Checks if the selection is valid or not.
 * @param repoSelection The selection to check.
 * @returns A boolean flag indicating if the selection is valid or not.
 */
export function isValidSelection(repoSelection: RepositorySelection): boolean {
  if (repoSelection.repositories === undefined && repoSelection.repositoryLists === undefined) {
    return false;
  }
  if (repoSelection.repositories !== undefined && repoSelection.repositories.length === 0) {
    return false;
  }
  if (repoSelection.repositoryLists?.length === 0) {
    return false;
  }

  return true;
}

function createSystemDefinedRepoListsQuickPickItems(): RepoListQuickPickItem[] {
  const topNs = [10, 100, 1000];

  return topNs.map(n => ({
    label: '$(star) Top ' + n,
    repositoryList: `top_${n}`,
    alwaysShow: true
  } as RepoListQuickPickItem));
}

function createUserDefinedRepoListsQuickPickItems(): RepoListQuickPickItem[] {
  const repoLists = getRemoteRepositoryLists();
  if (!repoLists) {
    return [];
  }

  return Object.entries(repoLists).map<RepoListQuickPickItem>(([label, repositories]) => (
    {
      label,            // the name of the repository list
      repositories  // the actual array of repositories
    }
  ));
}

function createCustomRepoQuickPickItem(): RepoListQuickPickItem {
  return {
    label: '$(edit) Enter a GitHub repository',
    useCustomRepository: true,
    alwaysShow: true,
  };
}

async function getCustomRepo(): Promise<string | undefined> {
  return await window.showInputBox({
    title: 'Enter a GitHub repository in the format <owner>/<repo> (e.g. github/codeql)',
    placeHolder: '<owner>/<repo>',
    prompt: 'Tip: you can save frequently used repositories in the `codeQL.variantAnalysis.repositoryLists` setting',
    ignoreFocusOut: true,
  });
}
