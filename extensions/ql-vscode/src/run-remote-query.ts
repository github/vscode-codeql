import { QuickPickItem, Uri, window } from 'vscode';
import * as yaml from 'js-yaml';
import * as fs from 'fs-extra';
import { getOnDiskWorkspaceFolders, showAndLogErrorMessage, showAndLogInformationMessage } from './helpers';
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

/**
 * Finds the language that a query targets.
 * If it can't be autodetected, prompt the user to specify the language manually.
 */
export async function findLanguage(
  cliServer: cli.CodeQLCliServer,
  queryUri: Uri | undefined
): Promise<string | undefined> {
  const uri = queryUri || window.activeTextEditor?.document.uri;
  if (uri !== undefined) {
    try {
      const queryInfo = await cliServer.resolveQueryByLanguage(getOnDiskWorkspaceFolders(), uri);
      const language = (Object.keys(queryInfo.byLanguage))[0];
      void logger.log(`Detected query language: ${language}`);
      return language;
    } catch (e) {
      void logger.log('Could not autodetect query language. Select language manually.');
    }
  }
  const availableLanguages = Object.keys(await cliServer.resolveLanguages());
  const language = await window.showQuickPick(
    availableLanguages,
    { placeHolder: 'Select target language for your query', ignoreFocusOut: true }
  );
  if (!language) {
    // This only happens if the user cancels the quick pick.
    void showAndLogErrorMessage('Language not found. Language must be specified manually.');
  }
  return language;
}

interface RepoListQuickPickItem extends QuickPickItem {
  repoList: string[];
}

/**
 * Gets the repositories to run the query against.
 */
async function getRepositories(): Promise<string[] | undefined> {
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
    if (quickpick && quickpick.repoList.length > 0) {
      void logger.log(`Selected repositories: ${quickpick.repoList}`);
      return quickpick.repoList;
    } else {
      void showAndLogErrorMessage('No repositories selected.');
      return;
    }
  } else {
    void showAndLogErrorMessage('No repository lists defined. You can define repository lists in the `codeQL.remoteRepositoryLists` setting.');
    return;
  }
}

export async function runRemoteQuery(cliServer: cli.CodeQLCliServer, credentials: Credentials, uri?: Uri) {
  if (!uri?.fsPath.endsWith('.ql')) {
    return;
  }

  const octokit = await credentials.getOctokit();
  const token = await credentials.getToken();

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
          token: token,
        }
      }
    );
    void showAndLogInformationMessage(`Successfully scheduled runs. [Click here to see the progress](https://github.com/${OWNER}/${REPO}/actions).`);

  } catch (error) {
    void showAndLogErrorMessage(error);
  }
}
