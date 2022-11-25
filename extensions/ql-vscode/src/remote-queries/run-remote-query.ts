import { CancellationToken, Uri, window } from "vscode";
import * as path from "path";
import * as yaml from "js-yaml";
import * as fs from "fs-extra";
import * as tmp from "tmp-promise";
import {
  askForLanguage,
  findLanguage,
  getOnDiskWorkspaceFolders,
  tryGetQueryMetadata,
  tmpDir,
} from "../helpers";
import { Credentials } from "../authentication";
import * as cli from "../cli";
import { logger } from "../common";
import {
  getActionBranch,
  getRemoteControllerRepo,
  setRemoteControllerRepo,
} from "../config";
import { ProgressCallback, UserCancellationException } from "../commandRunner";
import { RequestError } from "@octokit/types/dist-types";
import { QueryMetadata } from "../pure/interface-types";
import { getErrorMessage, REPO_REGEX } from "../pure/helpers-pure";
import * as ghApiClient from "./gh-api/gh-api-client";
import {
  getRepositorySelection,
  isValidSelection,
  RepositorySelection,
} from "./repository-selection";
import { Repository } from "./shared/repository";

export interface QlPack {
  name: string;
  version: string;
  dependencies: { [key: string]: string };
  defaultSuite?: Record<string, unknown>[];
  defaultSuiteFile?: string;
}

/**
 * Well-known names for the query pack used by the server.
 */
const QUERY_PACK_NAME = "codeql-remote/query";

export interface GeneratedQueryPack {
  base64Pack: string;
  language: string;
}

/**
 * Two possibilities:
 * 1. There is no qlpack.yml in this directory. Assume this is a lone query and generate a synthetic qlpack for it.
 * 2. There is a qlpack.yml in this directory. Assume this is a query pack and use the yml to pack the query before uploading it.
 *
 * @returns the entire qlpack as a base64 string.
 */
async function generateQueryPack(
  cliServer: cli.CodeQLCliServer,
  queryFile: string,
  queryPackDir: string,
): Promise<GeneratedQueryPack> {
  const originalPackRoot = await findPackRoot(queryFile);
  const packRelativePath = path.relative(originalPackRoot, queryFile);
  const targetQueryFileName = path.join(queryPackDir, packRelativePath);

  let language: string | undefined;
  if (await fs.pathExists(path.join(originalPackRoot, "qlpack.yml"))) {
    // don't include ql files. We only want the queryFile to be copied.
    const toCopy = await cliServer.packPacklist(originalPackRoot, false);

    // also copy the lock file (either new name or old name) and the query file itself. These are not included in the packlist.
    [
      path.join(originalPackRoot, "qlpack.lock.yml"),
      path.join(originalPackRoot, "codeql-pack.lock.yml"),
      queryFile,
    ].forEach((absolutePath) => {
      if (absolutePath) {
        toCopy.push(absolutePath);
      }
    });

    let copiedCount = 0;
    await fs.copy(originalPackRoot, queryPackDir, {
      filter: (file: string) =>
        // copy file if it is in the packlist, or it is a parent directory of a file in the packlist
        !!toCopy.find((f) => {
          // Normalized paths ensure that Windows drive letters are capitalized consistently.
          const normalizedPath = Uri.file(f).fsPath;
          const matches =
            normalizedPath === file ||
            normalizedPath.startsWith(file + path.sep);
          if (matches) {
            copiedCount++;
          }
          return matches;
        }),
    });

    void logger.log(`Copied ${copiedCount} files to ${queryPackDir}`);

    await fixPackFile(queryPackDir, packRelativePath);

    language = await findLanguage(cliServer, Uri.file(targetQueryFileName));
  } else {
    // open popup to ask for language if not already hardcoded
    language = await askForLanguage(cliServer);

    // copy only the query file to the query pack directory
    // and generate a synthetic query pack
    void logger.log(`Copying ${queryFile} to ${queryPackDir}`);
    await fs.copy(queryFile, targetQueryFileName);
    void logger.log("Generating synthetic query pack");
    const syntheticQueryPack = {
      name: QUERY_PACK_NAME,
      version: "0.0.0",
      dependencies: {
        [`codeql/${language}-all`]: "*",
      },
      defaultSuite: generateDefaultSuite(packRelativePath),
    };
    await fs.writeFile(
      path.join(queryPackDir, "qlpack.yml"),
      yaml.dump(syntheticQueryPack),
    );
  }
  if (!language) {
    throw new UserCancellationException("Could not determine language.");
  }

  // Clear the cliServer cache so that the previous qlpack text is purged from the CLI.
  await cliServer.clearCache();

  let precompilationOpts: string[] = [];
  if (await cliServer.cliConstraints.supportsQlxRemote()) {
    const ccache = path.join(originalPackRoot, ".cache");
    precompilationOpts = [
      "--qlx",
      "--no-default-compilation-cache",
      `--compilation-cache=${ccache}`,
    ];
  } else if (await cliServer.cliConstraints.supportsNoPrecompile()) {
    precompilationOpts = ["--no-precompile"];
  }

  const bundlePath = await getPackedBundlePath(queryPackDir);
  void logger.log(
    `Compiling and bundling query pack from ${queryPackDir} to ${bundlePath}. (This may take a while.)`,
  );
  await cliServer.packInstall(queryPackDir);
  const workspaceFolders = getOnDiskWorkspaceFolders();
  await cliServer.packBundle(
    queryPackDir,
    workspaceFolders,
    bundlePath,
    precompilationOpts,
  );
  const base64Pack = (await fs.readFile(bundlePath)).toString("base64");
  return {
    base64Pack,
    language,
  };
}

async function findPackRoot(queryFile: string): Promise<string> {
  // recursively find the directory containing qlpack.yml
  let dir = path.dirname(queryFile);
  while (!(await fs.pathExists(path.join(dir, "qlpack.yml")))) {
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
  return pathObj.root === dir && pathObj.base === "";
}

export async function createRemoteQueriesTempDirectory() {
  const remoteQueryDir = await tmp.dir({
    dir: tmpDir.name,
    unsafeCleanup: true,
  });
  const queryPackDir = path.join(remoteQueryDir.path, "query-pack");
  await fs.mkdirp(queryPackDir);
  return { remoteQueryDir, queryPackDir };
}

async function getPackedBundlePath(queryPackDir: string) {
  return tmp.tmpName({
    dir: path.dirname(queryPackDir),
    postfix: "generated.tgz",
    prefix: "qlpack",
  });
}

export interface PreparedRemoteQuery {
  actionBranch: string;
  base64Pack: string;
  repoSelection: RepositorySelection;
  queryFile: string;
  queryMetadata: QueryMetadata | undefined;
  controllerRepo: Repository;
  queryStartTime: number;
  language: string;
}

export async function prepareRemoteQueryRun(
  cliServer: cli.CodeQLCliServer,
  credentials: Credentials,
  uri: Uri | undefined,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<PreparedRemoteQuery> {
  if (!(await cliServer.cliConstraints.supportsRemoteQueries())) {
    throw new Error(
      `Variant analysis is not supported by this version of CodeQL. Please upgrade to v${cli.CliVersionConstraint.CLI_VERSION_REMOTE_QUERIES} or later.`,
    );
  }

  if (!uri?.fsPath.endsWith(".ql")) {
    throw new UserCancellationException("Not a CodeQL query file.");
  }

  const queryFile = uri.fsPath;

  progress({
    maxStep: 4,
    step: 1,
    message: "Determining query target language",
  });

  const repoSelection = await getRepositorySelection();
  if (!isValidSelection(repoSelection)) {
    throw new UserCancellationException("No repositories to query.");
  }

  progress({
    maxStep: 4,
    step: 2,
    message: "Determining controller repo",
  });

  const controllerRepo = await getControllerRepo(credentials);

  progress({
    maxStep: 4,
    step: 3,
    message: "Bundling the query pack",
  });

  if (token.isCancellationRequested) {
    throw new UserCancellationException("Cancelled");
  }

  const { remoteQueryDir, queryPackDir } =
    await createRemoteQueriesTempDirectory();

  let pack: GeneratedQueryPack;

  try {
    pack = await generateQueryPack(cliServer, queryFile, queryPackDir);
  } finally {
    await remoteQueryDir.cleanup();
  }

  const { base64Pack, language } = pack;

  if (token.isCancellationRequested) {
    throw new UserCancellationException("Cancelled");
  }

  progress({
    maxStep: 4,
    step: 4,
    message: "Sending request",
  });

  const actionBranch = getActionBranch();
  const queryStartTime = Date.now();
  const queryMetadata = await tryGetQueryMetadata(cliServer, queryFile);

  return {
    actionBranch,
    base64Pack,
    repoSelection,
    queryFile,
    queryMetadata,
    controllerRepo,
    queryStartTime,
    language,
  };
}

/**
 * Fixes the qlpack.yml file to be correct in the context of the MRVA request.
 *
 * Performs the following fixes:
 *
 * - Updates the default suite of the query pack. This is used to ensure
 *   only the specified query is run.
 * - Ensures the query pack name is set to the name expected by the server.
 * - Removes any `${workspace}` version references from the qlpack.yml file. Converts them
 *   to `*` versions.
 *
 * @param queryPackDir The directory containing the query pack
 * @param packRelativePath The relative path to the query pack from the root of the query pack
 */
async function fixPackFile(
  queryPackDir: string,
  packRelativePath: string,
): Promise<void> {
  const packPath = path.join(queryPackDir, "qlpack.yml");
  const qlpack = yaml.load(await fs.readFile(packPath, "utf8")) as QlPack;

  // update pack name
  qlpack.name = QUERY_PACK_NAME;

  // update default suite
  delete qlpack.defaultSuiteFile;
  qlpack.defaultSuite = generateDefaultSuite(packRelativePath);

  // remove any ${workspace} version references
  removeWorkspaceRefs(qlpack);

  await fs.writeFile(packPath, yaml.dump(qlpack));
}

function generateDefaultSuite(packRelativePath: string) {
  return [
    {
      description: "Query suite for variant analysis",
    },
    {
      query: packRelativePath.replace(/\\/g, "/"),
    },
  ];
}

export function getQueryName(
  queryMetadata: QueryMetadata | undefined,
  queryFilePath: string,
): string {
  // The query name is either the name as specified in the query metadata, or the file name.
  return queryMetadata?.name ?? path.basename(queryFilePath);
}

export async function getControllerRepo(
  credentials: Credentials,
): Promise<Repository> {
  // Get the controller repo from the config, if it exists.
  // If it doesn't exist, prompt the user to enter it, and save that value to the config.
  let controllerRepoNwo: string | undefined;
  controllerRepoNwo = getRemoteControllerRepo();
  if (!controllerRepoNwo || !REPO_REGEX.test(controllerRepoNwo)) {
    void logger.log(
      controllerRepoNwo
        ? "Invalid controller repository name."
        : "No controller repository defined.",
    );
    controllerRepoNwo = await window.showInputBox({
      title:
        "Controller repository in which to run the GitHub Actions workflow for this variant analysis",
      placeHolder: "<owner>/<repo>",
      prompt:
        "Enter the name of a GitHub repository in the format <owner>/<repo>",
      ignoreFocusOut: true,
    });
    if (!controllerRepoNwo) {
      throw new UserCancellationException("No controller repository entered.");
    } else if (!REPO_REGEX.test(controllerRepoNwo)) {
      // Check if user entered invalid input
      throw new UserCancellationException(
        "Invalid repository format. Must be a valid GitHub repository in the format <owner>/<repo>.",
      );
    }
    void logger.log(
      `Setting the controller repository as: ${controllerRepoNwo}`,
    );
    await setRemoteControllerRepo(controllerRepoNwo);
  }

  void logger.log(`Using controller repository: ${controllerRepoNwo}`);
  const [owner, repo] = controllerRepoNwo.split("/");

  try {
    const controllerRepo = await ghApiClient.getRepositoryFromNwo(
      credentials,
      owner,
      repo,
    );
    void logger.log(`Controller repository ID: ${controllerRepo.id}`);
    return {
      id: controllerRepo.id,
      fullName: controllerRepo.full_name,
      private: controllerRepo.private,
    };
  } catch (e) {
    if ((e as RequestError).status === 404) {
      throw new Error(`Controller repository "${owner}/${repo}" not found`);
    } else {
      throw new Error(
        `Error getting controller repository "${owner}/${repo}": ${getErrorMessage(
          e,
        )}`,
      );
    }
  }
}
export function removeWorkspaceRefs(qlpack: QlPack) {
  for (const [key, value] of Object.entries(qlpack.dependencies || {})) {
    if (value === "${workspace}") {
      qlpack.dependencies[key] = "*";
    }
  }
}
