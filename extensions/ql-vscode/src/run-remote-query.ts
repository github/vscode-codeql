import { CancellationToken, QuickPickItem, Uri, window } from 'vscode';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as fs from 'fs-extra';
import * as tmp from 'tmp-promise';
import { askForLanguage, findLanguage, getOnDiskWorkspaceFolders, showAndLogErrorMessage, showAndLogInformationMessage, showInformationMessageWithAction } from './helpers';
import { Credentials } from './authentication';
import * as cli from './cli';
import { logger } from './logging';
import { getRemoteControllerRepo, getRemoteRepositoryLists, setRemoteControllerRepo } from './config';
import { tmpDir } from './run-queries';
import { ProgressCallback, UserCancellationException } from './commandRunner';
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

/**
 * Two possibilities:
 * 1. There is no qlpack.yml in this directory. Assume this is a lone query and generate a synthetic qlpack for it.
 * 2. There is a qlpack.yml in this directory. Assume this is a query pack and use the yml to pack the query before uploading it.
 *
 * @returns the entire qlpack as a base64 string.
 */
async function generateQueryPack(cliServer: cli.CodeQLCliServer, queryFile: string, queryPackDir: string, fallbackLanguage?: string): Promise<{
  base64Pack: string,
  language: string
}> {
  const originalPackRoot = path.dirname(queryFile);
  // TODO this assumes that the qlpack.yml is in the same directory as the query file, but in reality,
  // the file could be in a parent directory.
  const targetQueryFileName = path.join(queryPackDir, path.basename(queryFile));

  // the server is expecting the query file to be named `query.ql`. Rename it here.
  const renamedQueryFile = path.join(queryPackDir, 'query.ql');

  let language: string | undefined;
  if (await fs.pathExists(path.join(originalPackRoot, 'qlpack.yml'))) {
    // don't include ql files. We only want the queryFile to be copied.
    const toCopy = await cliServer.packPacklist(originalPackRoot, false);

    // also copy the lock file (either new name or old name) and the query file itself. These are not included in the packlist.
    [path.join(originalPackRoot, 'qlpack.lock.yml'), path.join(originalPackRoot, 'codeql-pack.lock.yml'), queryFile]
      .forEach(absolutePath => {
        if (absolutePath) {
          toCopy.push(absolutePath);
        }
      });

    let copiedCount = 0;
    await fs.copy(originalPackRoot, queryPackDir, {
      filter: (file: string) =>
        // copy file if it is in the packlist, or it is a parent directory of a file in the packlist
        !!toCopy.find(f => {
          // Normalized paths ensure that Windows drive letters are capitalized consistently.
          const normalizedPath = Uri.file(f).fsPath;
          const matches = normalizedPath === file || normalizedPath.startsWith(file + path.sep);
          if (matches) {
            copiedCount++;
          }
          return matches;
        })
    });

    // ensure the qlpack.yml has a valid name
    await ensureQueryPackName(queryPackDir);

    void logger.log(`Copied ${copiedCount} files to ${queryPackDir}`);

    language = await findLanguage(cliServer, Uri.file(targetQueryFileName));

  } else {
    // open popup to ask for language if not already hardcoded
    language = fallbackLanguage || await askForLanguage(cliServer);

    // copy only the query file to the query pack directory
    // and generate a synthetic query pack
    // TODO this has a limitation that query packs inside of a workspace will not resolve its peer dependencies.
    // Something to work on later. For now, we will only support query packs that are not in a workspace.
    void logger.log(`Copying ${queryFile} to ${queryPackDir}`);
    await fs.copy(queryFile, targetQueryFileName);
    void logger.log('Generating synthetic query pack');
    const syntheticQueryPack = {
      name: 'codeql-remote/query',
      version: '0.0.0',
      dependencies: {
        [`codeql/${language}-all`]: '*',
      }
    };
    await fs.writeFile(path.join(queryPackDir, 'qlpack.yml'), yaml.safeDump(syntheticQueryPack));
  }
  if (!language) {
    throw new UserCancellationException('Could not determine language.');
  }

  await fs.rename(targetQueryFileName, renamedQueryFile);

  const bundlePath = await getPackedBundlePath(queryPackDir);
  void logger.log(`Compiling and bundling query pack from ${queryPackDir} to ${bundlePath}. (This may take a while.)`);
  await cliServer.packInstall(queryPackDir);
  const workspaceFolders = getOnDiskWorkspaceFolders();
  await cliServer.packBundle(queryPackDir, workspaceFolders, bundlePath, false);
  const base64Pack = (await fs.readFile(bundlePath)).toString('base64');
  return {
    base64Pack,
    language
  };
}

/**
 * Ensure that the qlpack.yml has a valid name. For local purposes,
 * Anonymous packs and names that are not prefixed by a scope (ie `<foo>/`)
 * are sufficient. But in order to create a pack, the name must be prefixed.
 *
 * @param queryPackDir the directory containing the query pack.
 */
async function ensureQueryPackName(queryPackDir: string) {
  const pack = yaml.safeLoad(await fs.readFile(path.join(queryPackDir, 'qlpack.yml'), 'utf8')) as { name: string; };
  if (!pack.name || !pack.name.includes('/')) {
    if (!pack.name) {
      pack.name = 'codeql-remote/query';
    } else if (!pack.name.includes('/')) {
      pack.name = `codeql-remote/${pack.name}`;
    }
    await fs.writeFile(path.join(queryPackDir, 'qlpack.yml'), yaml.safeDump(pack));
  }
}

async function createRemoteQueriesTempDirectory() {
  const remoteQueryDir = await tmp.dir({ dir: tmpDir.name, unsafeCleanup: true });
  const queryPackDir = path.join(remoteQueryDir.path, 'query-pack');
  await fs.mkdirp(queryPackDir);
  return { remoteQueryDir, queryPackDir };
}

async function getPackedBundlePath(queryPackDir: string) {
  return tmp.tmpName({
    dir: path.dirname(queryPackDir),
    postfix: 'generated.tgz',
    prefix: 'qlpack',
  });
}

export async function runRemoteQuery(
  cliServer: cli.CodeQLCliServer,
  credentials: Credentials,
  uri: Uri | undefined,
  dryRun: boolean,
  progress: ProgressCallback,
  token: CancellationToken
): Promise<void | string> {
  if (!(await cliServer.cliConstraints.supportsRemoteQueries())) {
    throw new Error(`Remote queries are not supported by this version of CodeQL. Please upgrade to v${cli.CliVersionConstraint.CLI_VERSION_REMOTE_QUERIES
      } or later.`);
  }

  const { remoteQueryDir, queryPackDir } = await createRemoteQueriesTempDirectory();
  try {
    if (!uri?.fsPath.endsWith('.ql')) {
      throw new UserCancellationException('Not a CodeQL query file.');
    }

    progress({
      maxStep: 5,
      step: 1,
      message: 'Determining project list'
    });

    const queryFile = uri.fsPath;
    const repositoriesFile = queryFile.substring(0, queryFile.length - '.ql'.length) + '.repositories';
    let ref: string | undefined;
    // For the case of single file remote queries, use the language from the config in order to avoid the user having to select it.
    let fallbackLanguage: string | undefined;
    let repositories: string[] | undefined;

    progress({
      maxStep: 5,
      step: 2,
      message: 'Determining query target language'
    });

    // If the user has an explicit `.repositories` file, use that.
    // Otherwise, prompt user to select repositories from the `codeQL.remoteQueries.repositoryLists` setting.
    if (await fs.pathExists(repositoriesFile)) {
      void logger.log(`Found '${repositoriesFile}'. Using information from that file to run ${queryFile}.`);

      const config = yaml.safeLoad(await fs.readFile(repositoriesFile, 'utf8')) as Config;

      ref = config.ref || 'main';
      fallbackLanguage = config.language;
      repositories = config.repositories;
    } else {
      ref = 'main';
      repositories = await getRepositories();
    }

    if (!repositories || repositories.length === 0) {
      throw new UserCancellationException('No repositories to query.');
    }

    progress({
      maxStep: 5,
      step: 3,
      message: 'Determining controller repo'
    });

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

    progress({
      maxStep: 5,
      step: 4,
      message: 'Bundling the query pack'
    });

    if (token.isCancellationRequested) {
      throw new UserCancellationException('Cancelled');
    }

    const { base64Pack, language } = await generateQueryPack(cliServer, queryFile, queryPackDir, fallbackLanguage);

    if (token.isCancellationRequested) {
      throw new UserCancellationException('Cancelled');
    }

    progress({
      maxStep: 5,
      step: 5,
      message: 'Sending request'
    });

    await runRemoteQueriesApiRequest(credentials, ref, language, repositories, owner, repo, base64Pack, dryRun);

    if (dryRun) {
      return remoteQueryDir.path;
    } else {
      // don't return the path because it has been deleted
      return;
    }

  } finally {
    if (dryRun) {
      // If we are in a dry run keep the data around for debugging purposes.
      void logger.log(`[DRY RUN] Not deleting ${queryPackDir}.`);
    } else {
      await remoteQueryDir.cleanup();
    }
  }
}

async function runRemoteQueriesApiRequest(
  credentials: Credentials,
  ref: string,
  language: string,
  repositories: string[],
  owner: string,
  repo: string,
  queryPackBase64: string,
  dryRun = false
): Promise<void> {

  if (dryRun) {
    void showAndLogInformationMessage('[DRY RUN] Would have sent request. See extension log for the payload.');
    void logger.log(JSON.stringify({ ref, language, repositories, owner, repo, queryPackBase64: queryPackBase64.substring(0, 100) + '... ' + queryPackBase64.length + ' bytes' }));
    return;
  }

  try {
    const octokit = await credentials.getOctokit();
    await octokit.request(
      'POST /repos/:owner/:repo/code-scanning/codeql/queries',
      {
        owner,
        repo,
        data: {
          ref,
          language,
          repositories,
          query_pack: queryPackBase64,
        }
      }
    );
    void showAndLogInformationMessage(`Successfully scheduled runs. [Click here to see the progress](https://github.com/${owner}/${repo}/actions).`);

  } catch (error) {
    await attemptRerun(error, credentials, ref, language, repositories, owner, repo, queryPackBase64, dryRun);
  }
}

/** Attempts to rerun the query on only the valid repositories */
export async function attemptRerun(
  error: any,
  credentials: Credentials,
  ref: string,
  language: string,
  repositories: string[],
  owner: string,
  repo: string,
  queryPackBase64: string,
  dryRun = false
) {
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
      await runRemoteQueriesApiRequest(credentials, ref, language, validRepositories, owner, repo, queryPackBase64, dryRun);
    }
  } else {
    void showAndLogErrorMessage(error);
  }
}
