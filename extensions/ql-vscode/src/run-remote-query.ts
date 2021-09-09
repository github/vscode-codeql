import { QuickPickItem, Uri, window } from 'vscode';
import * as yaml from 'js-yaml';
import * as fs from 'fs-extra';
import { findLanguage, showAndLogErrorMessage, showAndLogInformationMessage, showInformationMessageWithAction } from './helpers';
import { Credentials } from './authentication';
import * as cli from './cli';
import { logger } from './logging';
import { getRemoteRepositoryLists } from './config';
interface Config {
  repositories: string[];
  ref?: string;
  language?: string;
}

// Test "controller" repository and workflow.
const OWNER = 'dsp-testing';
const REPO = 'qc-controller';

interface RepoListQuickPickItem extends QuickPickItem {
  repoList: string[];
}

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
        placeHolder: 'Select a repository list. You can define repository lists in the `codeQL.remoteRepositoryLists` setting.',
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
    /**
     * This regex matches strings of the form `owner/repo` where:
     * - `owner` is made up of alphanumeric characters or single hyphens, starting and ending in an alphanumeric character
     * - `repo` is made up of alphanumeric characters, hyphens, or underscores
     */
    const repoRegex = /^(?:[a-zA-Z0-9]+-)*[a-zA-Z0-9]+\/[a-zA-Z0-9-_]+$/;
    const remoteRepo = await window.showInputBox({
      title: 'Enter a GitHub repository in the format <owner>/<repo> (e.g. github/codeql)',
      placeHolder: '<owner>/<repo>',
      prompt: 'Tip: you can save frequently used repositories in the `codeql.remoteRepositoryLists` setting',
      ignoreFocusOut: true,
    });
    if (!remoteRepo) {
      void showAndLogErrorMessage('No repositories entered.');
      return;
    } else if (!repoRegex.test(remoteRepo)) { // Check if user entered invalid input
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
  // Otherwise, prompt user to select repositories from the `codeQL.remoteRepositoryLists` setting.
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

  await runRemoteQueriesApiRequest(credentials, ref, language, repositories, query);
}

async function runRemoteQueriesApiRequest(credentials: Credentials, ref: string, language: string, repositories: string[], query: string) {
  const octokit = await credentials.getOctokit();

  try {
    await octokit.request(
      'POST /repos/:owner/:repo/code-scanning/codeql/queries',
      {
        owner: OWNER,
        repo: REPO,
        data: {
          ref: ref,
          language: language,
          repositories: repositories,
          query: query,
        }
      }
    );
    void showAndLogInformationMessage(`Successfully scheduled runs. [Click here to see the progress](https://github.com/${OWNER}/${REPO}/actions).`);

  } catch (error) {
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
        await runRemoteQueriesApiRequest(credentials, ref, language, validRepositories, query);
      }

    } else {
      void showAndLogErrorMessage(error);
    }
  }
}
