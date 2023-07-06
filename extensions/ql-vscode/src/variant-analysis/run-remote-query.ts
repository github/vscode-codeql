import { CancellationToken, Uri, window } from "vscode";
import { relative, join, sep, dirname, parse, basename } from "path";
import { dump, load } from "js-yaml";
import { copy, writeFile, readFile, mkdirp } from "fs-extra";
import { dir, tmpName } from "tmp-promise";
import { tmpDir } from "../tmp-dir";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { Credentials } from "../common/authentication";
import * as cli from "../codeql-cli/cli";
import { extLogger } from "../common/logging/vscode";
import {
  getActionBranch,
  getRemoteControllerRepo,
  setRemoteControllerRepo,
} from "../config";
import {
  ProgressCallback,
  UserCancellationException,
} from "../common/vscode/progress";
import { RequestError } from "@octokit/types/dist-types";
import { QueryMetadata } from "../common/interface-types";
import { getErrorMessage, REPO_REGEX } from "../common/helpers-pure";
import { getRepositoryFromNwo } from "./gh-api/gh-api-client";
import {
  getRepositorySelection,
  isValidSelection,
  RepositorySelection,
} from "./repository-selection";
import { Repository } from "./shared/repository";
import { DbManager } from "../databases/db-manager";
import {
  getQlPackPath,
  FALLBACK_QLPACK_FILENAME,
  QLPACK_FILENAMES,
  QLPACK_LOCK_FILENAMES,
} from "../common/ql";
import { QueryLanguage } from "../common/query-language";
import { tryGetQueryMetadata } from "../codeql-cli/query-metadata";
import { askForLanguage, findLanguage } from "../codeql-cli/query-language";

export interface QlPack {
  name: string;
  version: string;
  library?: boolean;
  dependencies: { [key: string]: string };
  defaultSuite?: Array<Record<string, unknown>>;
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
 * 1. There is no qlpack.yml (or codeql-pack.yml) in this directory. Assume this is a lone query and generate a synthetic qlpack for it.
 * 2. There is a qlpack.yml (or codeql-pack.yml) in this directory. Assume this is a query pack and use the yml to pack the query before uploading it.
 *
 * @returns the entire qlpack as a base64 string.
 */
async function generateQueryPack(
  cliServer: cli.CodeQLCliServer,
  queryFile: string,
  queryPackDir: string,
): Promise<GeneratedQueryPack> {
  const originalPackRoot = await findPackRoot(queryFile);
  const packRelativePath = relative(originalPackRoot, queryFile);
  const targetQueryFileName = join(queryPackDir, packRelativePath);
  const workspaceFolders = getOnDiskWorkspaceFolders();

  let language: QueryLanguage | undefined;

  // Check if the query is already in a query pack.
  // If so, copy the entire query pack to the temporary directory.
  // Otherwise, copy only the query file to the temporary directory
  // and generate a synthetic query pack.
  if (await getQlPackPath(originalPackRoot)) {
    // don't include ql files. We only want the queryFile to be copied.
    await copyExistingQueryPack(
      cliServer,
      originalPackRoot,
      queryFile,
      queryPackDir,
      packRelativePath,
    );

    language = await findLanguage(cliServer, Uri.file(targetQueryFileName));
  } else {
    // open popup to ask for language if not already hardcoded
    language = await askForLanguage(cliServer);

    // copy only the query file to the query pack directory
    // and generate a synthetic query pack
    await createNewQueryPack(
      queryFile,
      queryPackDir,
      targetQueryFileName,
      language,
      packRelativePath,
    );
  }
  if (!language) {
    throw new UserCancellationException("Could not determine language.");
  }

  // Clear the cliServer cache so that the previous qlpack text is purged from the CLI.
  await cliServer.clearCache();

  let precompilationOpts: string[] = [];
  if (await cliServer.cliConstraints.supportsQlxRemote()) {
    if (await cliServer.cliConstraints.usesGlobalCompilationCache()) {
      precompilationOpts = ["--qlx"];
    } else {
      const ccache = join(originalPackRoot, ".cache");
      precompilationOpts = [
        "--qlx",
        "--no-default-compilation-cache",
        `--compilation-cache=${ccache}`,
      ];
    }
  } else {
    precompilationOpts = ["--no-precompile"];
  }

  if (await cliServer.useExtensionPacks()) {
    await injectExtensionPacks(cliServer, queryPackDir, workspaceFolders);
  }

  await cliServer.packInstall(queryPackDir, {
    workspaceFolders,
  });

  // Clear the CLI cache so that the most recent qlpack lock file is used.
  await cliServer.clearCache();

  const bundlePath = await getPackedBundlePath(queryPackDir);
  void extLogger.log(
    `Compiling and bundling query pack from ${queryPackDir} to ${bundlePath}. (This may take a while.)`,
  );
  await cliServer.packBundle(
    queryPackDir,
    workspaceFolders,
    bundlePath,
    precompilationOpts,
  );
  const base64Pack = (await readFile(bundlePath)).toString("base64");
  return {
    base64Pack,
    language,
  };
}

async function createNewQueryPack(
  queryFile: string,
  queryPackDir: string,
  targetQueryFileName: string,
  language: string | undefined,
  packRelativePath: string,
) {
  void extLogger.log(`Copying ${queryFile} to ${queryPackDir}`);
  await copy(queryFile, targetQueryFileName);
  void extLogger.log("Generating synthetic query pack");
  const syntheticQueryPack = {
    name: QUERY_PACK_NAME,
    version: "0.0.0",
    dependencies: {
      [`codeql/${language}-all`]: "*",
    },
    defaultSuite: generateDefaultSuite(packRelativePath),
  };
  await writeFile(
    join(queryPackDir, FALLBACK_QLPACK_FILENAME),
    dump(syntheticQueryPack),
  );
}

async function copyExistingQueryPack(
  cliServer: cli.CodeQLCliServer,
  originalPackRoot: string,
  queryFile: string,
  queryPackDir: string,
  packRelativePath: string,
) {
  const toCopy = await cliServer.packPacklist(originalPackRoot, false);

  [
    // also copy the lock file (either new name or old name) and the query file itself. These are not included in the packlist.
    ...QLPACK_LOCK_FILENAMES.map((f) => join(originalPackRoot, f)),
    queryFile,
  ].forEach((absolutePath) => {
    if (absolutePath) {
      toCopy.push(absolutePath);
    }
  });

  let copiedCount = 0;
  await copy(originalPackRoot, queryPackDir, {
    filter: (file: string) =>
      // copy file if it is in the packlist, or it is a parent directory of a file in the packlist
      !!toCopy.find((f) => {
        // Normalized paths ensure that Windows drive letters are capitalized consistently.
        const normalizedPath = Uri.file(f).fsPath;
        const matches =
          normalizedPath === file || normalizedPath.startsWith(file + sep);
        if (matches) {
          copiedCount++;
        }
        return matches;
      }),
  });

  void extLogger.log(`Copied ${copiedCount} files to ${queryPackDir}`);

  await fixPackFile(queryPackDir, packRelativePath);
}

async function findPackRoot(queryFile: string): Promise<string> {
  // recursively find the directory containing qlpack.yml or codeql-pack.yml
  let dir = dirname(queryFile);
  while (!(await getQlPackPath(dir))) {
    dir = dirname(dir);
    if (isFileSystemRoot(dir)) {
      // there is no qlpack.yml or codeql-pack.yml in this directory or any parent directory.
      // just use the query file's directory as the pack root.
      return dirname(queryFile);
    }
  }

  return dir;
}

function isFileSystemRoot(dir: string): boolean {
  const pathObj = parse(dir);
  return pathObj.root === dir && pathObj.base === "";
}

export async function createRemoteQueriesTempDirectory() {
  const remoteQueryDir = await dir({
    dir: tmpDir.name,
    unsafeCleanup: true,
  });
  const queryPackDir = join(remoteQueryDir.path, "query-pack");
  await mkdirp(queryPackDir);
  return { remoteQueryDir, queryPackDir };
}

async function getPackedBundlePath(queryPackDir: string) {
  return tmpName({
    dir: dirname(queryPackDir),
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
  dbManager: DbManager,
): Promise<PreparedRemoteQuery> {
  if (!uri?.fsPath.endsWith(".ql")) {
    throw new UserCancellationException("Not a CodeQL query file.");
  }

  const queryFile = uri.fsPath;

  progress({
    maxStep: 4,
    step: 1,
    message: "Determining query target language",
  });

  const repoSelection = await getRepositorySelection(dbManager);
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
 * Fixes the qlpack.yml or codeql-pack.yml file to be correct in the context of the MRVA request.
 *
 * Performs the following fixes:
 *
 * - Updates the default suite of the query pack. This is used to ensure
 *   only the specified query is run.
 * - Ensures the query pack name is set to the name expected by the server.
 * - Removes any `${workspace}` version references from the qlpack.yml or codeql-pack.yml file. Converts them
 *   to `*` versions.
 *
 * @param queryPackDir The directory containing the query pack
 * @param packRelativePath The relative path to the query pack from the root of the query pack
 */
async function fixPackFile(
  queryPackDir: string,
  packRelativePath: string,
): Promise<void> {
  const packPath = await getQlPackPath(queryPackDir);

  // This should not happen since we create the pack ourselves.
  if (!packPath) {
    throw new Error(
      `Could not find ${QLPACK_FILENAMES.join(
        " or ",
      )} file in '${queryPackDir}'`,
    );
  }
  const qlpack = load(await readFile(packPath, "utf8")) as QlPack;

  updateDefaultSuite(qlpack, packRelativePath);
  removeWorkspaceRefs(qlpack);

  await writeFile(packPath, dump(qlpack));
}

async function injectExtensionPacks(
  cliServer: cli.CodeQLCliServer,
  queryPackDir: string,
  workspaceFolders: string[],
) {
  const qlpackFile = await getQlPackPath(queryPackDir);
  if (!qlpackFile) {
    throw new Error(
      `Could not find ${QLPACK_FILENAMES.join(
        " or ",
      )} file in '${queryPackDir}'`,
    );
  }
  const syntheticQueryPack = load(await readFile(qlpackFile, "utf8")) as QlPack;

  const extensionPacks = await cliServer.resolveQlpacks(workspaceFolders, true);
  Object.entries(extensionPacks).forEach(([name, paths]) => {
    // We are guaranteed that there is at least one path found for each extension pack.
    // If there are multiple paths, then we have a problem. This means that there is
    // ambiguity in which path to use. This is an error.
    if (paths.length > 1) {
      throw new Error(
        `Multiple versions of extension pack '${name}' found: ${paths.join(
          ", ",
        )}`,
      );
    }
    // Add this extension pack as a dependency. It doesn't matter which
    // version we specify, since we are guaranteed that the extension pack
    // is resolved from source at the given path.
    syntheticQueryPack.dependencies[name] = "*";
  });
  await writeFile(qlpackFile, dump(syntheticQueryPack));
  await cliServer.clearCache();
}

function updateDefaultSuite(qlpack: QlPack, packRelativePath: string) {
  delete qlpack.defaultSuiteFile;
  qlpack.defaultSuite = generateDefaultSuite(packRelativePath);
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
  return queryMetadata?.name ?? basename(queryFilePath);
}

export async function getControllerRepo(
  credentials: Credentials,
): Promise<Repository> {
  // Get the controller repo from the config, if it exists.
  // If it doesn't exist, prompt the user to enter it, check
  // whether the repo exists, and save the nwo to the config.

  let shouldSetControllerRepo = false;
  let controllerRepoNwo: string | undefined;
  controllerRepoNwo = getRemoteControllerRepo();
  if (!controllerRepoNwo || !REPO_REGEX.test(controllerRepoNwo)) {
    void extLogger.log(
      controllerRepoNwo
        ? "Invalid controller repository name."
        : "No controller repository defined.",
    );
    controllerRepoNwo = await window.showInputBox({
      title:
        "Controller repository in which to run GitHub Actions workflows for variant analyses",
      placeHolder: "<owner>/<repo>",
      prompt:
        "Enter the name of a GitHub repository in the format <owner>/<repo>. You can change this in the extension settings.",
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

    shouldSetControllerRepo = true;
  }

  void extLogger.log(`Using controller repository: ${controllerRepoNwo}`);
  const controllerRepo = await getControllerRepoFromApi(
    credentials,
    controllerRepoNwo,
  );

  if (shouldSetControllerRepo) {
    void extLogger.log(
      `Setting the controller repository as: ${controllerRepoNwo}`,
    );
    await setRemoteControllerRepo(controllerRepoNwo);
  }

  return controllerRepo;
}

async function getControllerRepoFromApi(
  credentials: Credentials,
  nwo: string,
): Promise<Repository> {
  const [owner, repo] = nwo.split("/");
  try {
    const controllerRepo = await getRepositoryFromNwo(credentials, owner, repo);
    void extLogger.log(`Controller repository ID: ${controllerRepo.id}`);
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
