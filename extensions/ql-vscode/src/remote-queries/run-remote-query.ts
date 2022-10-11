import { CancellationToken, commands, Uri, window } from 'vscode';
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
  pluralize,
  tmpDir,
} from '../helpers';
import { Credentials } from '../authentication';
import * as cli from '../cli';
import { logger } from '../logging';
import { getActionBranch, getRemoteControllerRepo, isVariantAnalysisLiveResultsEnabled, setRemoteControllerRepo } from '../config';
import { ProgressCallback, UserCancellationException } from '../commandRunner';
import { OctokitResponse, RequestError } from '@octokit/types/dist-types';
import { RemoteQuery } from './remote-query';
import { RemoteQuerySubmissionResult } from './remote-query-submission-result';
import { QueryMetadata } from '../pure/interface-types';
import { getErrorMessage, REPO_REGEX } from '../pure/helpers-pure';
import * as ghApiClient from './gh-api/gh-api-client';
import { getRepositorySelection, isValidSelection, RepositorySelection } from './repository-selection';
import { parseVariantAnalysisQueryLanguage, VariantAnalysisSubmission } from './shared/variant-analysis';
import { Repository } from './shared/repository';
import { processVariantAnalysis } from './variant-analysis-processor';
import { VariantAnalysisManager } from './variant-analysis-manager';

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
    private_repositories?: string[],
    cutoff_repositories?: string[],
    cutoff_repositories_count?: number,
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
      // there is no qlpack.yml in this directory or any parent directory.
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
  token: CancellationToken,
  variantAnalysisManager: VariantAnalysisManager
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

    const controllerRepo = await getControllerRepo(credentials);

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
    const queryStartTime = Date.now();
    const queryMetadata = await tryGetQueryMetadata(cliServer, queryFile);

    if (isVariantAnalysisLiveResultsEnabled()) {
      const queryName = getQueryName(queryMetadata, queryFile);
      const variantAnalysisLanguage = parseVariantAnalysisQueryLanguage(language);
      if (variantAnalysisLanguage === undefined) {
        throw new UserCancellationException(`Found unsupported language: ${language}`);
      }

      const variantAnalysisSubmission: VariantAnalysisSubmission = {
        startTime: queryStartTime,
        actionRepoRef: actionBranch,
        controllerRepoId: controllerRepo.id,
        query: {
          name: queryName,
          filePath: queryFile,
          pack: base64Pack,
          language: variantAnalysisLanguage,
        },
        databases: {
          repositories: repoSelection.repositories,
          repositoryLists: repoSelection.repositoryLists,
          repositoryOwners: repoSelection.owners
        }
      };

      const variantAnalysisResponse = await ghApiClient.submitVariantAnalysis(
        credentials,
        variantAnalysisSubmission
      );

      const processedVariantAnalysis = processVariantAnalysis(variantAnalysisSubmission, variantAnalysisResponse);

      variantAnalysisManager.onVariantAnalysisSubmitted(processedVariantAnalysis);

      void logger.log(`Variant analysis:\n${JSON.stringify(processedVariantAnalysis, null, 2)}`);

      void showAndLogInformationMessage(`Variant analysis ${processedVariantAnalysis.query.name} submitted for processing`);

      void commands.executeCommand('codeQL.openVariantAnalysisView', processedVariantAnalysis.id);
      void commands.executeCommand('codeQL.monitorVariantAnalysis', processedVariantAnalysis);

      return { variantAnalysis: processedVariantAnalysis };
    } else {
      const apiResponse = await runRemoteQueriesApiRequest(credentials, actionBranch, language, repoSelection, controllerRepo, base64Pack, dryRun);

      if (dryRun) {
        return { queryDirPath: remoteQueryDir.path };
      } else {
        if (!apiResponse) {
          return;
        }

        const workflowRunId = apiResponse.workflow_run_id;
        const repositoryCount = apiResponse.repositories_queried.length;
        const remoteQuery = await buildRemoteQueryEntity(
          queryFile,
          queryMetadata,
          controllerRepo,
          queryStartTime,
          workflowRunId,
          language,
          repositoryCount);

        // don't return the path because it has been deleted
        return { query: remoteQuery };
      }
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
  controllerRepo: Repository,
  queryPackBase64: string,
  dryRun = false
): Promise<void | QueriesResponse> {
  const data = {
    ref,
    language,
    repositories: repoSelection.repositories ?? undefined,
    repository_lists: repoSelection.repositoryLists ?? undefined,
    repository_owners: repoSelection.owners ?? undefined,
    query_pack: queryPackBase64,
  };

  if (dryRun) {
    void showAndLogInformationMessage('[DRY RUN] Would have sent request. See extension log for the payload.');
    void logger.log(JSON.stringify({
      controllerRepo,
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
      'POST /repositories/:controllerRepoId/code-scanning/codeql/queries',
      {
        controllerRepoId: controllerRepo.id,
        data
      }
    );
    const { popupMessage, logMessage } = parseResponse(controllerRepo, response.data);
    void showAndLogInformationMessage(popupMessage, { fullMessage: logMessage });
    return response.data;
  } catch (error: any) {
    if (error.status === 404) {
      void showAndLogErrorMessage(`Controller repository was not found. Please make sure it's a valid repo name.${eol}`);
    } else {
      void showAndLogErrorMessage(getErrorMessage(error));
    }
  }
}

const eol = os.EOL;
const eol2 = os.EOL + os.EOL;

// exported for testing only
export function parseResponse(controllerRepo: Repository, response: QueriesResponse) {
  const repositoriesQueried = response.repositories_queried;
  const repositoryCount = repositoriesQueried.length;

  const popupMessage = `Successfully scheduled runs on ${pluralize(repositoryCount, 'repository', 'repositories')}. [Click here to see the progress](https://github.com/${controllerRepo.fullName}/actions/runs/${response.workflow_run_id}).`
    + (response.errors ? `${eol2}Some repositories could not be scheduled. See extension log for details.` : '');

  let logMessage = `Successfully scheduled runs on ${pluralize(repositoryCount, 'repository', 'repositories')}. See https://github.com/${controllerRepo.fullName}/actions/runs/${response.workflow_run_id}.`;
  logMessage += `${eol2}Repositories queried:${eol}${repositoriesQueried.join(', ')}`;
  if (response.errors) {
    const { invalid_repositories, repositories_without_database, private_repositories, cutoff_repositories, cutoff_repositories_count } = response.errors;
    logMessage += `${eol2}Some repositories could not be scheduled.`;
    if (invalid_repositories?.length) {
      logMessage += `${eol2}${pluralize(invalid_repositories.length, 'repository', 'repositories')} invalid and could not be found:${eol}${invalid_repositories.join(', ')}`;
    }
    if (repositories_without_database?.length) {
      logMessage += `${eol2}${pluralize(repositories_without_database.length, 'repository', 'repositories')} did not have a CodeQL database available:${eol}${repositories_without_database.join(', ')}`;
      logMessage += `${eol}For each public repository that has not yet been added to the database service, we will try to create a database next time the store is updated.`;
    }
    if (private_repositories?.length) {
      logMessage += `${eol2}${pluralize(private_repositories.length, 'repository', 'repositories')} not public:${eol}${private_repositories.join(', ')}`;
      logMessage += `${eol}When using a public controller repository, only public repositories can be queried.`;
    }
    if (cutoff_repositories_count) {
      logMessage += `${eol2}${pluralize(cutoff_repositories_count, 'repository', 'repositories')} over the limit for a single request`;
      if (cutoff_repositories) {
        logMessage += `:${eol}${cutoff_repositories.join(', ')}`;
        if (cutoff_repositories_count !== cutoff_repositories.length) {
          const moreRepositories = cutoff_repositories_count - cutoff_repositories.length;
          logMessage += `${eol}...${eol}And another ${pluralize(moreRepositories, 'repository', 'repositories')}.`;
        }
      } else {
        logMessage += '.';
      }
      logMessage += `${eol}Repositories were selected based on how recently they had been updated.`;
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
  controllerRepo: Repository,
  queryStartTime: number,
  workflowRunId: number,
  language: string,
  repositoryCount: number
): Promise<RemoteQuery> {
  const queryName = getQueryName(queryMetadata, queryFilePath);
  const queryText = await fs.readFile(queryFilePath, 'utf8');
  const [owner, name] = controllerRepo.fullName.split('/');

  return {
    queryName,
    queryFilePath,
    queryText,
    language,
    controllerRepository: {
      owner,
      name,
    },
    executionStartTime: queryStartTime,
    actionsWorkflowRunId: workflowRunId,
    repositoryCount,
  };
}

function getQueryName(queryMetadata: QueryMetadata | undefined, queryFilePath: string): string {
  // The query name is either the name as specified in the query metadata, or the file name.
  return queryMetadata?.name ?? path.basename(queryFilePath);
}

async function getControllerRepo(credentials: Credentials): Promise<Repository> {
  // Get the controller repo from the config, if it exists.
  // If it doesn't exist, prompt the user to enter it, and save that value to the config.
  let controllerRepoNwo: string | undefined;
  controllerRepoNwo = getRemoteControllerRepo();
  if (!controllerRepoNwo || !REPO_REGEX.test(controllerRepoNwo)) {
    void logger.log(controllerRepoNwo ? 'Invalid controller repository name.' : 'No controller repository defined.');
    controllerRepoNwo = await window.showInputBox({
      title: 'Controller repository in which to run the GitHub Actions workflow for this variant analysis',
      placeHolder: '<owner>/<repo>',
      prompt: 'Enter the name of a GitHub repository in the format <owner>/<repo>',
      ignoreFocusOut: true,
    });
    if (!controllerRepoNwo) {
      throw new UserCancellationException('No controller repository entered.');
    } else if (!REPO_REGEX.test(controllerRepoNwo)) { // Check if user entered invalid input
      throw new UserCancellationException('Invalid repository format. Must be a valid GitHub repository in the format <owner>/<repo>.');
    }
    void logger.log(`Setting the controller repository as: ${controllerRepoNwo}`);
    await setRemoteControllerRepo(controllerRepoNwo);
  }

  void logger.log(`Using controller repository: ${controllerRepoNwo}`);
  const [owner, repo] = controllerRepoNwo.split('/');

  try {
    const controllerRepo = await ghApiClient.getRepositoryFromNwo(credentials, owner, repo);
    void logger.log(`Controller repository ID: ${controllerRepo.id}`);
    return {
      id: controllerRepo.id,
      fullName: controllerRepo.full_name,
      private: controllerRepo.private,
    };

  } catch (e: any) {
    if ((e as RequestError).status === 404) {
      throw new Error(`Controller repository "${owner}/${repo}" not found`);
    } else {
      throw new Error(`Error getting controller repository "${owner}/${repo}": ${e.message}`);
    }
  }
}
