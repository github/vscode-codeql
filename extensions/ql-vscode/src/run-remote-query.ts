import { QuickPickItem, Uri, window } from 'vscode';
import * as yaml from 'js-yaml';
import * as fs from 'fs-extra';
import { findLanguage, showAndLogErrorMessage, showAndLogInformationMessage, showInformationMessageWithAction } from './helpers';
import { Credentials } from './authentication';
import * as cli from './cli';
import { logger } from './logging';
import { getRemoteControllerRepo, getRemoteRepositoryLists, setRemoteControllerRepo } from './config';
interface Config {
  repositories: string[];
  ref?: string;
  language?: string;
}

interface RepoListQuickPickItem extends QuickPickItem {
  repoList: string[];
}

/**
 * This regex matches strings of the form `owner/repo` where:
 * - `owner` is made up of alphanumeric characters or single hyphens, starting and ending in an alphanumeric character
 * - `repo` is made up of alphanumeric characters, hyphens, or underscores
 */
const REPO_REGEX = /^(?:[a-zA-Z0-9]+-)*[a-zA-Z0-9]+\/[a-zA-Z0-9-_]+$/;

/**
 * Gets the repositories to run the query against.
 */
export async function getRepositories(): Promise<string[] | undefined> {
  const repoLists = getRemoteRepositoryLists();
  if (repoLists && Object.keys(repoLists).length) {
    const quickPickItems = Object.entries(repoLists).map<RepoListQuickPickItem>(([key, value]) => (
      {
        label: key,       // the name of the repository list
        repoList: value,  // the actual array of repositories
      }
    ));
    const quickpick = await window.showQuickPick<RepoListQuickPickItem>(
      quickPickItems,
      {
        placeHolder: 'Select a repository list. You can define repository lists in the `codeQL.remoteQueries.repositoryLists` setting.',
        ignoreFocusOut: true,
      });
    if (quickpick?.repoList.length) {
      void logger.log(`Selected repositories: ${quickpick.repoList.join(', ')}`);
      return quickpick.repoList;
    } else {
      void showAndLogErrorMessage('No repositories selected.');
      return;
    }
  } else {
    void logger.log('No repository lists defined. Displaying text input box.');
    const remoteRepo = await window.showInputBox({
      title: 'Enter a GitHub repository in the format <owner>/<repo> (e.g. github/codeql)',
      placeHolder: '<owner>/<repo>',
      prompt: 'Tip: you can save frequently used repositories in the `codeQL.remoteQueries.repositoryLists` setting',
      ignoreFocusOut: true,
    });
    if (!remoteRepo) {
      void showAndLogErrorMessage('No repositories entered.');
      return;
    } else if (!REPO_REGEX.test(remoteRepo)) { // Check if user entered invalid input
      void showAndLogErrorMessage('Invalid repository format. Must be in the format <owner>/<repo> (e.g. github/codeql)');
      return;
    }
    void logger.log(`Entered repository: ${remoteRepo}`);
    return [remoteRepo];
  }
}

export async function runRemoteQuery(cliServer: cli.CodeQLCliServer, credentials: Credentials, uri?: Uri) {
  if (!uri?.fsPath.endsWith('.ql')) {
    return;
  }

  const queryFile = uri.fsPath;
  const query = await fs.readFile(queryFile, 'utf8');

  const repositoriesFile = queryFile.substring(0, queryFile.length - '.ql'.length) + '.repositories';
  let ref: string | undefined;
  let language: string | undefined;
  let repositories: string[] | undefined;

  // If the user has an explicit `.repositories` file, use that.
  // Otherwise, prompt user to select repositories from the `codeQL.remoteQueries.repositoryLists` setting.
  if (await fs.pathExists(repositoriesFile)) {
    void logger.log(`Found '${repositoriesFile}'. Using information from that file to run ${queryFile}.`);

    const config = yaml.safeLoad(await fs.readFile(repositoriesFile, 'utf8')) as Config;

    ref = config.ref || 'main';
    language = config.language || await findLanguage(cliServer, uri);
    repositories = config.repositories;
  } else {
    ref = 'main';
    [language, repositories] = await Promise.all([findLanguage(cliServer, uri), getRepositories()]);
  }

  if (!language) {
    return; // No error message needed, since `findLanguage` already displays one.
  }

  if (!repositories || repositories.length === 0) {
    return; // No error message needed, since `getRepositories` already displays one.
  }

  // Get the controller repo from the config, if it exists.
  // If it doesn't exist, prompt the user to enter it, and save that value to the config.
  let controllerRepo: string | undefined;
  controllerRepo = getRemoteControllerRepo();
  if (!controllerRepo || !REPO_REGEX.test(controllerRepo)) {
    void logger.log(controllerRepo ? 'Invalid controller repository name.' : 'No controller repository defined.');
    controllerRepo = await window.showInputBox({
      title: 'Controller repository in which to display progress and results of remote queries',
      placeHolder: '<owner>/<repo>',
      prompt: 'Enter the name of a GitHub repository in the format <owner>/<repo>',
      ignoreFocusOut: true,
    });
    if (!controllerRepo) {
      void showAndLogErrorMessage('No controller repository entered.');
      return;
    } else if (!REPO_REGEX.test(controllerRepo)) { // Check if user entered invalid input
      void showAndLogErrorMessage('Invalid repository format. Must be a valid GitHub repository in the format <owner>/<repo>.');
      return;
    }
    void logger.log(`Setting the controller repository as: ${controllerRepo}`);
    await setRemoteControllerRepo(controllerRepo);
  }

  void logger.log(`Using controller repository: ${controllerRepo}`);
  const [owner, repo] = controllerRepo.split('/');

  await runRemoteQueriesApiRequest(credentials, ref, language, repositories, query, owner, repo);
}

async function runRemoteQueriesApiRequest(credentials: Credentials, ref: string, language: string, repositories: string[], query: string, owner: string, repo: string) {
  const octokit = await credentials.getOctokit();

  try {
    await octokit.request(
      'POST /repos/:owner/:repo/code-scanning/codeql/queries',
      {
        owner,
        repo,
        data: {
          ref: ref,
          language: language,
          repositories: repositories,
          query: query,
        }
      }
    );
    void showAndLogInformationMessage(`Successfully scheduled runs. [Click here to see the progress](https://github.com/${owner}/${repo}/actions).`);

  } catch (error) {
    await attemptRerun(error, credentials, ref, language, repositories, query, owner, repo);
  }
}

/** Attempts to rerun the query on only the valid repositories */
export async function attemptRerun(error: any, credentials: Credentials, ref: string, language: string, repositories: string[], query: string, owner: string, repo: string) {
  if (typeof error.message === 'string' && error.message.includes('Some repositories were invalid')) {
    const invalidRepos = error?.response?.data?.invalid_repos || [];
    const reposWithoutDbUploads = error?.response?.data?.repos_without_db_uploads || [];
    void logger.log('Unable to run query on some of the specified repositories');
    if (invalidRepos.length > 0) {
      void logger.log(`Invalid repos: ${invalidRepos.join(', ')}`);
    }
    if (reposWithoutDbUploads.length > 0) {
      void logger.log(`Repos without DB uploads: ${reposWithoutDbUploads.join(', ')}`);
    }

    if (invalidRepos.length + reposWithoutDbUploads.length === repositories.length) {
      // Every repo is invalid in some way
      void showAndLogErrorMessage('Unable to run query on any of the specified repositories.');
      return;
    }

    const popupMessage = 'Unable to run query on some of the specified repositories. [See logs for more details](command:codeQL.showLogs).';
    const rerunQuery = await showInformationMessageWithAction(popupMessage, 'Rerun on the valid repositories only');
    if (rerunQuery) {
      const validRepositories = repositories.filter(r => !invalidRepos.includes(r) && !reposWithoutDbUploads.includes(r));
      void logger.log(`Rerunning query on set of valid repositories: ${JSON.stringify(validRepositories)}`);
      await runRemoteQueriesApiRequest(credentials, ref, language, validRepositories, query, owner, repo);
    }

  } else {
    void showAndLogErrorMessage(error);
  }

}
