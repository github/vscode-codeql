import { CancellationToken, Uri } from 'vscode';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as tmp from 'tmp-promise';
import {
  askForLanguage,
  findLanguage,
  getOnDiskWorkspaceFolders,
  showAndLogErrorMessage,
  showAndLogInformationMessage,
  tryGetQueryMetadata,
  tmpDir
} from '../helpers';
import { Credentials } from '../authentication';
import * as cli from '../cli';
import { logger } from '../logging';
import { getActionBranch } from '../config';
import { ProgressCallback, UserCancellationException } from '../commandRunner';
import { OctokitResponse } from '@octokit/types/dist-types';
import { RemoteQuery } from './remote-query';
import { RemoteQuerySubmissionResult } from './remote-query-submission-result';
import { QueryMetadata } from '../pure/interface-types';
import { getErrorMessage } from '../pure/helpers-pure';
import { getRepositorySelection, isValidSelection, RepositorySelection } from './repository-selection';
import { getControllerRepoSelection } from './repository';

export interface QlPack {
  name: string;
  version: string;
  dependencies: { [key: string]: string };
  defaultSuite?: Record<string, unknown>[];
  defaultSuiteFile?: string;
}

interface QueriesResponse {
  workflow_run_id: number,
  errors?: {
    invalid_repositories?: string[],
    repositories_without_database?: string[],
  },
  repositories_queried: string[],
}

/**
 * Well-known names for the query pack used by the server.
 */
const QUERY_PACK_NAME = 'codeql-remote/query';

/**
 * Two possibilities:
 * 1. There is no qlpack.yml in this directory. Assume this is a lone query and generate a synthetic qlpack for it.
 * 2. There is a qlpack.yml in this directory. Assume this is a query pack and use the yml to pack the query before uploading it.
 *
 * @returns the entire qlpack as a base64 string.
 */
async function generateQueryPack(cliServer: cli.CodeQLCliServer, queryFile: string, queryPackDir: string): Promise<{
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
    language = await askForLanguage(cliServer);

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
    await fs.writeFile(path.join(queryPackDir, 'qlpack.yml'), yaml.dump(syntheticQueryPack));
  }
  if (!language) {
    throw new UserCancellationException('Could not determine language.');
  }

  await ensureNameAndSuite(queryPackDir, packRelativePath);

  // Clear the cliServer cache so that the previous qlpack text is purged from the CLI.
  await cliServer.clearCache();

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
    throw new Error(`Variant analysis is not supported by this version of CodeQL. Please upgrade to v${cli.CliVersionConstraint.CLI_VERSION_REMOTE_QUERIES
      } or later.`);
  }

  const { remoteQueryDir, queryPackDir } = await createRemoteQueriesTempDirectory();
  try {
    if (!uri?.fsPath.endsWith('.ql')) {
      throw new UserCancellationException('Not a CodeQL query file.');
    }

    const queryFile = uri.fsPath;

    progress({
      maxStep: 4,
      step: 1,
      message: 'Determining query target language'
    });

    const repoSelection = await getRepositorySelection();
    if (!isValidSelection(repoSelection)) {
      throw new UserCancellationException('No repositories to query.');
    }

    progress({
      maxStep: 4,
      step: 2,
      message: 'Determining controller repo'
    });

    const controllerRepoSelection = await getControllerRepoSelection();
    const [owner, repo] = controllerRepoSelection.split('/');

    progress({
      maxStep: 4,
      step: 3,
      message: 'Bundling the query pack'
    });

    if (token.isCancellationRequested) {
      throw new UserCancellationException('Cancelled');
    }

    const { base64Pack, language } = await generateQueryPack(cliServer, queryFile, queryPackDir);

    if (token.isCancellationRequested) {
      throw new UserCancellationException('Cancelled');
    }

    progress({
      maxStep: 4,
      step: 4,
      message: 'Sending request'
    });

    const actionBranch = getActionBranch();
    const workflowRunId = await runRemoteQueriesApiRequest(credentials, actionBranch, language, repoSelection, owner, repo, base64Pack, dryRun);
    const queryStartTime = Date.now();
    const queryMetadata = await tryGetQueryMetadata(cliServer, queryFile);

    if (dryRun) {
      return { queryDirPath: remoteQueryDir.path };
    } else {
      if (!workflowRunId) {
        return;
      }

      const remoteQuery = await buildRemoteQueryEntity(
        queryFile,
        queryMetadata,
        owner,
        repo,
        queryStartTime,
        workflowRunId,
        language);

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
  repoSelection: RepositorySelection,
  owner: string,
  repo: string,
  queryPackBase64: string,
  dryRun = false
): Promise<void | number> {
  const data = {
    ref,
    language,
    repositories: repoSelection.repositories ?? undefined,
    repository_lists: repoSelection.repositoryLists ?? undefined,
    query_pack: queryPackBase64,
  };

  if (dryRun) {
    void showAndLogInformationMessage('[DRY RUN] Would have sent request. See extension log for the payload.');
    void logger.log(JSON.stringify({
      owner,
      repo,
      data: {
        ...data,
        queryPackBase64: queryPackBase64.substring(0, 100) + '... ' + queryPackBase64.length + ' bytes'
      }
    }));
    return;
  }

  try {
    const octokit = await credentials.getOctokit();
    const response: OctokitResponse<QueriesResponse, number> = await octokit.request(
      'POST /repos/:owner/:repo/code-scanning/codeql/queries',
      {
        owner,
        repo,
        data
      }
    );
    const { popupMessage, logMessage } = parseResponse(owner, repo, response.data);
    void showAndLogInformationMessage(popupMessage, { fullMessage: logMessage });
    return response.data.workflow_run_id;
  } catch (error) {
    void showAndLogErrorMessage(getErrorMessage(error));
  }
}

const eol = os.EOL;
const eol2 = os.EOL + os.EOL;

// exported for testing only
export function parseResponse(owner: string, repo: string, response: QueriesResponse) {
  const repositoriesQueried = response.repositories_queried;
  const numRepositoriesQueried = repositoriesQueried.length;

  const popupMessage = `Successfully scheduled runs on ${numRepositoriesQueried} repositories. [Click here to see the progress](https://github.com/${owner}/${repo}/actions/runs/${response.workflow_run_id}).`
    + (response.errors ? `${eol2}Some repositories could not be scheduled. See extension log for details.` : '');

  let logMessage = `Successfully scheduled runs on ${numRepositoriesQueried} repositories. See https://github.com/${owner}/${repo}/actions/runs/${response.workflow_run_id}.`;
  logMessage += `${eol2}Repositories queried:${eol}${repositoriesQueried.join(', ')}`;
  if (response.errors) {
    logMessage += `${eol2}Some repositories could not be scheduled.`;
    if (response.errors.invalid_repositories?.length) {
      logMessage += `${eol2}Invalid repositories:${eol}${response.errors.invalid_repositories.join(', ')}`;
    }
    if (response.errors.repositories_without_database?.length) {
      logMessage += `${eol2}Repositories without databases:${eol}${response.errors.repositories_without_database.join(', ')}`;
      logMessage += `${eol}For each public repository that has not yet been added to the database service, we will try to create a database next time the store is updated.`;
    }
  }

  return {
    popupMessage,
    logMessage
  };
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
  const qlpack = yaml.load(await fs.readFile(packPath, 'utf8')) as QlPack;
  delete qlpack.defaultSuiteFile;

  qlpack.name = QUERY_PACK_NAME;

  qlpack.defaultSuite = [{
    description: 'Query suite for variant analysis'
  }, {
    query: packRelativePath.replace(/\\/g, '/')
  }];
  await fs.writeFile(packPath, yaml.dump(qlpack));
}

async function buildRemoteQueryEntity(
  queryFilePath: string,
  queryMetadata: QueryMetadata | undefined,
  controllerRepoOwner: string,
  controllerRepoName: string,
  queryStartTime: number,
  workflowRunId: number,
  language: string
): Promise<RemoteQuery> {
  // The query name is either the name as specified in the query metadata, or the file name.
  const queryName = queryMetadata?.name ?? path.basename(queryFilePath);

  const queryText = await fs.readFile(queryFilePath, 'utf8');

  return {
    queryName,
    queryFilePath,
    queryText,
    language,
    controllerRepository: {
      owner: controllerRepoOwner,
      name: controllerRepoName,
    },
    executionStartTime: queryStartTime,
    actionsWorkflowRunId: workflowRunId
  };
}
