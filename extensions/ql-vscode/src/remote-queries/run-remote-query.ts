import { CancellationToken, QuickPickItem, Uri, window } from 'vscode';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as fs from 'fs-extra';
import * as tmp from 'tmp-promise';
import { askForLanguage, findLanguage, getOnDiskWorkspaceFolders, showAndLogErrorMessage, showAndLogInformationMessage, showAndLogWarningMessage, showInformationMessageWithAction } from '../helpers';
import { Credentials } from '../authentication';
import * as cli from '../cli';
import { logger } from '../logging';
import { getRemoteControllerRepo, getRemoteRepositoryLists, setRemoteControllerRepo } from '../config';
import { tmpDir } from '../run-queries';
import { ProgressCallback, UserCancellationException } from '../commandRunner';
import { OctokitResponse } from '@octokit/types/dist-types';
import * as unzipper from 'unzipper';
import { RemoteQuery } from './remote-query';
import { RemoteQuerySubmissionResult } from './remote-query-submission-result';

interface Config {
  repositories: string[];
  ref?: string;
  language?: string;
}

export interface QlPack {
  name: string;
  version: string;
  dependencies: { [key: string]: string };
  defaultSuite?: Record<string, unknown>[];
  defaultSuiteFile?: string;
}
interface RepoListQuickPickItem extends QuickPickItem {
  repoList: string[];
}

interface QueriesResponse {
  workflow_run_id: number
}

/**
 * This regex matches strings of the form `owner/repo` where:
 * - `owner` is made up of alphanumeric characters or single hyphens, starting and ending in an alphanumeric character
 * - `repo` is made up of alphanumeric characters, hyphens, or underscores
 */
const REPO_REGEX = /^(?:[a-zA-Z0-9]+-)*[a-zA-Z0-9]+\/[a-zA-Z0-9-_]+$/;

/**
 * Well-known names for the query pack used by the server.
 */
const QUERY_PACK_NAME = 'codeql-remote/query';

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
  const originalPackRoot = await findPackRoot(queryFile);
  const packRelativePath = path.relative(originalPackRoot, queryFile);
  const targetQueryFileName = path.join(queryPackDir, packRelativePath);

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

    void logger.log(`Copied ${copiedCount} files to ${queryPackDir}`);

    language = await findLanguage(cliServer, Uri.file(targetQueryFileName));

  } else {
    // open popup to ask for language if not already hardcoded
    language = fallbackLanguage || await askForLanguage(cliServer);

    // copy only the query file to the query pack directory
    // and generate a synthetic query pack
    void logger.log(`Copying ${queryFile} to ${queryPackDir}`);
    await fs.copy(queryFile, targetQueryFileName);
    void logger.log('Generating synthetic query pack');
    const syntheticQueryPack = {
      name: QUERY_PACK_NAME,
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

  await ensureNameAndSuite(queryPackDir, packRelativePath);

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

async function findPackRoot(queryFile: string): Promise<string> {
  // recursively find the directory containing qlpack.yml
  let dir = path.dirname(queryFile);
  while (!(await fs.pathExists(path.join(dir, 'qlpack.yml')))) {
    dir = path.dirname(dir);
    if (isFileSystemRoot(dir)) {
      // there is no qlpack.yml in this direcory or any parent directory.
      // just use the query file's directory as the pack root.
      return path.dirname(queryFile);
    }
  }

  return dir;
}

function isFileSystemRoot(dir: string): boolean {
  const pathObj = path.parse(dir);
  return pathObj.root === dir && pathObj.base === '';
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
): Promise<void | RemoteQuerySubmissionResult> {
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

    const workflowRunId = await runRemoteQueriesApiRequest(credentials, ref, language, repositories, owner, repo, base64Pack, dryRun);
    const queryStartTime = new Date();

    if (dryRun) {
      return { queryDirPath: remoteQueryDir.path };
    } else {
      if (!workflowRunId) {
        return;
      }

      const remoteQuery = buildRemoteQueryEntity(repositories, queryFile, owner, repo, queryStartTime, workflowRunId);

      // don't return the path because it has been deleted
      return { query: remoteQuery };
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
): Promise<void | number> {
  if (dryRun) {
    void showAndLogInformationMessage('[DRY RUN] Would have sent request. See extension log for the payload.');
    void logger.log(JSON.stringify({ ref, language, repositories, owner, repo, queryPackBase64: queryPackBase64.substring(0, 100) + '... ' + queryPackBase64.length + ' bytes' }));
    return;
  }

  try {
    const octokit = await credentials.getOctokit();
    const response: OctokitResponse<QueriesResponse, number> = await octokit.request(
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
    const workflowRunId = response.data.workflow_run_id;
    void showAndLogInformationMessage(`Successfully scheduled runs. [Click here to see the progress](https://github.com/${owner}/${repo}/actions/runs/${workflowRunId}).`);
    return workflowRunId;
  } catch (error) {
    return await attemptRerun(error, credentials, ref, language, repositories, owner, repo, queryPackBase64, dryRun);
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
      return await runRemoteQueriesApiRequest(credentials, ref, language, validRepositories, owner, repo, queryPackBase64, dryRun);
    }
  } else {
    void showAndLogErrorMessage(error);
  }
}

/**
 * Updates the default suite of the query pack. This is used to ensure
 * only the specified query is run.
 *
 * Also, ensure the query pack name is set to the name expected by the server.
 *
 * @param queryPackDir The directory containing the query pack
 * @param packRelativePath The relative path to the query pack from the root of the query pack
 */
async function ensureNameAndSuite(queryPackDir: string, packRelativePath: string): Promise<void> {
  const packPath = path.join(queryPackDir, 'qlpack.yml');
  const qlpack = yaml.safeLoad(await fs.readFile(packPath, 'utf8')) as QlPack;
  delete qlpack.defaultSuiteFile;

  qlpack.name = QUERY_PACK_NAME;

  qlpack.defaultSuite = [{
    description: 'Query suite for remote query'
  }, {
    query: packRelativePath.replace(/\\/g, '/')
  }];
  await fs.writeFile(packPath, yaml.safeDump(qlpack));
}

/**
 * Lists the workflow run artifacts for the given workflow run ID.
 * @param credentials Credentials for authenticating to the GitHub API.
 * @param owner
 * @param repo
 * @param workflowRunId The ID of the workflow run to list artifacts for.
 * @returns An array of artifact details (including artifact name and ID).
 */
async function listWorkflowRunArtifacts(
  credentials: Credentials,
  owner: string,
  repo: string,
  workflowRunId: number
) {
  const octokit = await credentials.getOctokit();
  const response = await octokit.rest.actions.listWorkflowRunArtifacts({
    owner,
    repo,
    run_id: workflowRunId,
  });

  return response.data.artifacts;
}

/**
 * @param artifactName The artifact name, as a string.
 * @param artifacts An array of artifact details (from the "list workflow run artifacts" API response).
 * @returns The artifact ID corresponding to the given artifact name.
 */
function getArtifactIDfromName(artifactName: string, artifacts: Array<{ id: number, name: string }>): number | undefined {
  const artifact = artifacts.find(a => a.name === artifactName);
  return artifact?.id;
}

/**
 * Downloads an artifact from a workflow run.
 * @param credentials Credentials for authenticating to the GitHub API.
 * @param owner
 * @param repo
 * @param artifactId The ID of the artifact to download.
 * @returns The path to the enclosing directory of the unzipped artifact.
 */
async function downloadArtifact(
  credentials: Credentials,
  owner: string,
  repo: string,
  artifactId: number
): Promise<string> {
  const octokit = await credentials.getOctokit();
  const response = await octokit.rest.actions.downloadArtifact({
    owner,
    repo,
    artifact_id: artifactId,
    archive_format: 'zip',
  });
  const artifactPath = path.join(tmpDir.name, `${artifactId}`);
  void logger.log(`Downloading artifact to ${artifactPath}.zip`);
  await fs.writeFile(
    `${artifactPath}.zip`,
    Buffer.from(response.data as ArrayBuffer)
  );

  void logger.log(`Extracting artifact to ${artifactPath}`);
  await (
    await unzipper.Open.file(`${artifactPath}.zip`)
  ).extract({ path: artifactPath });
  return artifactPath;
}

interface ResultIndexItem {
  nwo: string;
  id: string;
  results_count: number;
  bqrs_file_size: number;
  sarif_file_size?: number;
}

/**
 * Gets the result index file for a given remote queries run.
 * @param credentials Credentials for authenticating to the GitHub API.
 * @param owner
 * @param repo
 * @param workflowRunId The ID of the workflow run to get the result index for.
 * @returns An object containing the result index.
 */
export async function getResultIndex(
  credentials: Credentials,
  owner: string,
  repo: string,
  workflowRunId: number
): Promise<ResultIndexItem[]> {
  const artifactList = await listWorkflowRunArtifacts(credentials, owner, repo, workflowRunId);
  const artifactId = getArtifactIDfromName('result-index', artifactList);
  if (!artifactId) {
    void showAndLogWarningMessage(
      `Could not find a result index for the [specified workflow](https://github.com/${owner}/${repo}/actions/runs/${workflowRunId}).
      Please check whether the workflow run has successfully completed.`
    );
    return [];
  }
  const artifactPath = await downloadArtifact(credentials, owner, repo, artifactId);
  const indexFilePath = path.join(artifactPath, 'index.json');
  if (!(await fs.pathExists(indexFilePath))) {
    void showAndLogWarningMessage('Could not find an `index.json` file in the result artifact.');
    return [];
  }
  const resultIndex = await fs.readFile(path.join(artifactPath, 'index.json'), 'utf8');

  try {
    return JSON.parse(resultIndex);
  } catch (error) {
    throw new Error(`Invalid result index file: ${error}`);
  }
}

function buildRemoteQueryEntity(
  repositories: string[],
  queryFilePath: string,
  controllerRepoOwner: string,
  controllerRepoName: string,
  queryStartTime: Date,
  workflowRunId: number
): RemoteQuery {
  // For now, just use the file name as the query name. 
  const queryName = path.basename(queryFilePath);

  const queryRepos = repositories.map(r => {
    const [owner, repo] = r.split('/');
    return { owner: owner, name: repo };
  });

  return {
    queryName,
    queryFilePath,
    controllerRepository: {
      owner: controllerRepoOwner,
      name: controllerRepoName,
    },
    repositories: queryRepos,
    executionStartTime: queryStartTime,
    actionsWorkflowRunId: workflowRunId
  };
}
