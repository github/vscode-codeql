import * as fs from 'fs-extra';
import { QuickPickItem, window } from 'vscode';
import { logger } from '../logging';
import { getRemoteRepositoryLists, getRemoteRepositoryListsPath } from '../config';
import { OWNER_REGEX, REPO_REGEX } from '../pure/helpers-pure';
import { UserCancellationException } from '../commandRunner';

export interface RepositorySelection {
  repositories?: string[];
  repositoryLists?: string[];
  owners?: string[];
}

interface RepoListQuickPickItem extends QuickPickItem {
  repositories?: string[];
  repositoryList?: string;
  useCustomRepo?: boolean;
  useAllReposOfOwner?: boolean;
}

interface RepoList {
  label: string;
  repositories: string[];
}

/**
 * Gets the repositories or repository lists to run the query against.
 * @returns The user selection.
 */
export async function getRepositorySelection(): Promise<RepositorySelection> {
  const quickPickItems = [
    createCustomRepoQuickPickItem(),
    createAllReposOfOwnerQuickPickItem(),
    ...createSystemDefinedRepoListsQuickPickItems(),
    ...(await createUserDefinedRepoListsQuickPickItems()),
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
  } else if (quickpick?.useAllReposOfOwner) {
    const owner = await getOwner();
    if (!owner || !OWNER_REGEX.test(owner)) {
      throw new Error(`Invalid user or organization: ${owner}`);
    }
    void logger.log(`Entered owner: ${owner}`);
    return { owners: [owner] };
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
  const owners = repoSelection.owners || [];

  return (repositories.length > 0 || repositoryLists.length > 0 || owners.length > 0);
}

function createSystemDefinedRepoListsQuickPickItems(): RepoListQuickPickItem[] {
  const topNs = [10, 100, 1000];

  return topNs.map(n => ({
    label: '$(star) Top ' + n,
    repositoryList: `top_${n}`,
    alwaysShow: true
  } as RepoListQuickPickItem));
}

async function readExternalRepoLists(): Promise<RepoList[]> {
  const repoLists: RepoList[] = [];

  const path = getRemoteRepositoryListsPath();
  if (!path) {
    return repoLists;
  }

  await validateExternalRepoListsFile(path);
  const json = await readExternalRepoListsJson(path);

  for (const [repoListName, repositories] of Object.entries(json)) {
    if (!Array.isArray(repositories)) {
      throw Error('Invalid repository lists file. It should contain an array of repositories for each list.');
    }

    repoLists.push({
      label: repoListName,
      repositories
    });
  }

  return repoLists;
}

async function validateExternalRepoListsFile(path: string): Promise<void> {
  const pathExists = await fs.pathExists(path);
  if (!pathExists) {
    throw Error(`External repository lists file does not exist at ${path}`);
  }

  const pathStat = await fs.stat(path);
  if (pathStat.isDirectory()) {
    throw Error('External repository lists path should not point to a directory');
  }
}

async function readExternalRepoListsJson(path: string): Promise<Record<string, unknown>> {
  let json;

  try {
    const fileContents = await fs.readFile(path, 'utf8');
    json = await JSON.parse(fileContents);
  } catch (error) {
    throw Error('Invalid repository lists file. It should contain valid JSON.');
  }

  if (Array.isArray(json)) {
    throw Error('Invalid repository lists file. It should be an object mapping names to a list of repositories.');
  }

  return json;
}

function readRepoListsFromSettings(): RepoList[] {
  const repoLists = getRemoteRepositoryLists();
  if (!repoLists) {
    return [];
  }

  return Object.entries(repoLists).map<RepoList>(([label, repositories]) => (
    {
      label,
      repositories
    }
  ));
}

async function createUserDefinedRepoListsQuickPickItems(): Promise<RepoListQuickPickItem[]> {
  const repoListsFromSetings = readRepoListsFromSettings();
  const repoListsFromExternalFile = await readExternalRepoLists();

  return [...repoListsFromSetings, ...repoListsFromExternalFile];
}

function createCustomRepoQuickPickItem(): RepoListQuickPickItem {
  return {
    label: '$(edit) Enter a GitHub repository',
    useCustomRepo: true,
    alwaysShow: true,
  };
}

function createAllReposOfOwnerQuickPickItem(): RepoListQuickPickItem {
  return {
    label: '$(edit) Enter a GitHub user or organization',
    useAllReposOfOwner: true,
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

async function getOwner(): Promise<string | undefined> {
  return await window.showInputBox({
    title: 'Enter a GitHub user or organization',
    ignoreFocusOut: true,
  });
}
