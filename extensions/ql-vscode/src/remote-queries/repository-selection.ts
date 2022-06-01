import { QuickPickItem, window } from 'vscode';
import { logger } from '../logging';
import { getRemoteRepositoryLists } from '../config';
import { ORG_REGEX, REPO_REGEX } from '../pure/helpers-pure';
import { UserCancellationException } from '../commandRunner';

export interface RepositorySelection {
  repositories?: string[];
  repositoryLists?: string[];
  organisations?: string[];
}

interface RepoListQuickPickItem extends QuickPickItem {
  repositories?: string[];
  repositoryList?: string;
  useCustomRepo?: boolean;
  useAllReposOfOrg?: boolean;
}

/**
 * Gets the repositories or repository lists to run the query against.
 * @returns The user selection.
 */
export async function getRepositorySelection(): Promise<RepositorySelection> {
  const quickPickItems = [
    createCustomRepoQuickPickItem(),
    createAllReposOfOrgQuickPickItem(),
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
  } else if (quickpick?.useCustomRepo) {
    const customRepo = await getCustomRepo();
    if (!customRepo || !REPO_REGEX.test(customRepo)) {
      throw new UserCancellationException('Invalid repository format. Please enter a valid repository in the format <owner>/<repo> (e.g. github/codeql)');
    }
    void logger.log(`Entered repository: ${customRepo}`);
    return { repositories: [customRepo] };
  } else if (quickpick?.useAllReposOfOrg) {
    const org = await getOrganization();
    if (!org || !ORG_REGEX.test(org)) {
      throw new UserCancellationException('Invalid organization format. Please enter a valid organization (e.g. github)');
    }
    void logger.log(`Entered organization: ${org}`);
    return { organisations: [org] };
  } else {
    // We don't need to display a warning pop-up in this case, since the user just escaped out of the operation.
    // We set 'true' to make this a silent exception.
    throw new UserCancellationException('No repositories selected', true);
  }
}

/**
 * Checks if the selection is valid or not.
 * @param repoSelection The selection to check.
 * @returns A boolean flag indicating if the selection is valid or not.
 */
export function isValidSelection(repoSelection: RepositorySelection): boolean {
  const repositories = repoSelection.repositories || [];
  const repositoryLists = repoSelection.repositoryLists || [];
  const organisations = repoSelection.organisations || [];

  return (repositories.length > 0 || repositoryLists.length > 0 || organisations.length > 0);
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
    useCustomRepo: true,
    alwaysShow: true,
  };
}

function createAllReposOfOrgQuickPickItem(): RepoListQuickPickItem {
  return {
    label: '$(edit) Enter a GitHub organization',
    useAllReposOfOrg: true,
    alwaysShow: true
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

async function getOrganization(): Promise<string | undefined> {
  return await window.showInputBox({
    title: 'Enter a GitHub organization',
    ignoreFocusOut: true,
  });
}
