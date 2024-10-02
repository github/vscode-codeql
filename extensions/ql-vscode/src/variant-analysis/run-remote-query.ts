import type { CancellationToken } from "vscode";
import { Uri, window } from "vscode";
import { join, sep, basename, relative } from "path";
import { dump, load } from "js-yaml";
import { copy, writeFile, readFile, mkdirp } from "fs-extra";
import type { DirectoryResult } from "tmp-promise";
import { dir, tmpName } from "tmp-promise";
import { tmpDir } from "../tmp-dir";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import type { Credentials } from "../common/authentication";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import { extLogger } from "../common/logging/vscode";
import {
  getActionBranch,
  getRemoteControllerRepo,
  setRemoteControllerRepo,
} from "../config";
import type { ProgressCallback } from "../common/vscode/progress";
import { UserCancellationException } from "../common/vscode/progress";
import type { RequestError } from "@octokit/types/dist-types";
import type { QueryMetadata } from "../common/interface-types";
import { getErrorMessage, REPO_REGEX } from "../common/helpers-pure";
import { getRepositoryFromNwo } from "./gh-api/gh-api-client";
import type { RepositorySelection } from "./repository-selection";
import {
  getRepositorySelection,
  isValidSelection,
} from "./repository-selection";
import type { Repository } from "./shared/repository";
import type { DbManager } from "../databases/db-manager";
import {
  getQlPackFilePath,
  FALLBACK_QLPACK_FILENAME,
  QLPACK_FILENAMES,
  QLPACK_LOCK_FILENAMES,
} from "../common/ql";
import type { QlPackFile } from "../packaging/qlpack-file";
import { expandShortPaths } from "../common/short-paths";
import type { QlPackDetails } from "./ql-pack-details";
import type { ModelPackDetails } from "../common/model-pack-details";

/**
 * Well-known names for the query pack used by the server.
 */
const QUERY_PACK_NAME = "codeql-remote/query";

interface GeneratedQlPackDetails {
  base64Pack: string;
  modelPacks: ModelPackDetails[];
}

/**
 * Two possibilities:
 * 1. There is no qlpack.yml (or codeql-pack.yml) in this directory. Assume this is a lone query and generate a synthetic qlpack for it.
 * 2. There is a qlpack.yml (or codeql-pack.yml) in this directory. Assume this is a query pack and use the yml to pack the query before uploading it.
 *
 * @returns details about the generated QL pack.
 */
async function generateQueryPack(
  cliServer: CodeQLCliServer,
  qlPackDetails: QlPackDetails,
  tmpDir: RemoteQueryTempDir,
  token: CancellationToken,
): Promise<GeneratedQlPackDetails> {
  const workspaceFolders = getOnDiskWorkspaceFolders();
  const extensionPacks = await getExtensionPacksToInject(
    cliServer,
    workspaceFolders,
  );

  const mustSynthesizePack = qlPackDetails.qlPackFilePath === undefined;
  const cliSupportsMrvaPackCreate =
    await cliServer.cliConstraints.supportsMrvaPackCreate();

  let targetPackPath: string;
  let needsInstall: boolean;
  if (mustSynthesizePack) {
    // This section applies whether or not the CLI supports MRVA pack creation directly.

    targetPackPath = tmpDir.queryPackDir;

    // Synthesize a query pack for the query.
    // copy only the query file to the query pack directory
    // and generate a synthetic query pack
    await createNewQueryPack(qlPackDetails, targetPackPath);
    // Clear the cliServer cache so that the previous qlpack text is purged from the CLI.
    await cliServer.clearCache();

    // Install packs, since we just synthesized a dependency on the language's standard library.
    needsInstall = true;
  } else if (!cliSupportsMrvaPackCreate) {
    // We need to copy the query pack to a temporary directory and then fix it up to work with MRVA.
    targetPackPath = tmpDir.queryPackDir;
    await copyExistingQueryPack(cliServer, qlPackDetails, targetPackPath);

    // We should already have all the dependencies available, but these older versions of the CLI
    // have a bug where they will not search `--additional-packs` during validation in `codeql pack bundle`.
    // Installing the packs will ensure that any extension packs get put in the right place.
    needsInstall = true;
  } else {
    // The CLI supports creating a MRVA query pack directly from the source pack.
    targetPackPath = qlPackDetails.qlPackRootPath;
    // We expect any dependencies to be available already.
    needsInstall = false;
  }

  if (needsInstall) {
    // Install the dependencies of the synthesized query pack.
    await cliServer.packInstall(targetPackPath, {
      workspaceFolders,
    });

    // Clear the CLI cache so that the most recent qlpack lock file is used.
    await cliServer.clearCache();
  }

  let precompilationOpts: string[];
  if (cliSupportsMrvaPackCreate) {
    const queryOpts = qlPackDetails.queryFiles.flatMap((q) => [
      "--query",
      join(targetPackPath, relative(qlPackDetails.qlPackRootPath, q)),
    ]);

    precompilationOpts = [
      "--mrva",
      ...queryOpts,
      // We need to specify the extension packs as dependencies so that they are included in the MRVA pack.
      // The version range doesn't matter, since they'll always be found by source lookup.
      ...extensionPacks.map((p) => `--extension-pack=${p.name}@*`),
    ];
  } else {
    precompilationOpts = ["--qlx"];

    if (extensionPacks.length > 0) {
      await addExtensionPacksAsDependencies(targetPackPath, extensionPacks);
    }
  }

  const bundlePath = tmpDir.bundleFile;
  void extLogger.log(
    `Compiling and bundling query pack from ${targetPackPath} to ${bundlePath}. (This may take a while.)`,
  );
  await cliServer.packBundle(
    targetPackPath,
    workspaceFolders,
    bundlePath,
    tmpDir.compiledPackDir,
    precompilationOpts,
    token,
  );
  const base64Pack = (await readFile(bundlePath)).toString("base64");
  return {
    base64Pack,
    modelPacks: extensionPacks,
  };
}

async function createNewQueryPack(
  qlPackDetails: QlPackDetails,
  targetPackPath: string,
) {
  for (const queryFile of qlPackDetails.queryFiles) {
    void extLogger.log(`Copying ${queryFile} to ${targetPackPath}`);
    const relativeQueryPath = relative(qlPackDetails.qlPackRootPath, queryFile);
    const targetQueryFileName = join(targetPackPath, relativeQueryPath);
    await copy(queryFile, targetQueryFileName);
  }

  void extLogger.log("Generating synthetic query pack");
  const syntheticQueryPack = {
    name: QUERY_PACK_NAME,
    version: "0.0.0",
    dependencies: {
      [`codeql/${qlPackDetails.language}-all`]: "*",
    },
    defaultSuite: generateDefaultSuite(qlPackDetails),
  };

  await writeFile(
    join(targetPackPath, FALLBACK_QLPACK_FILENAME),
    dump(syntheticQueryPack),
  );
}

async function copyExistingQueryPack(
  cliServer: CodeQLCliServer,
  qlPackDetails: QlPackDetails,
  targetPackPath: string,
) {
  const toCopy = await cliServer.packPacklist(
    qlPackDetails.qlPackRootPath,
    false,
  );

  // Also include query files that contain extensible predicates. These query files are not
  // needed for the query to run, but they are needed for the query pack to pass deep validation
  // of data extensions.
  const metadata = await cliServer.generateExtensiblePredicateMetadata(
    qlPackDetails.qlPackRootPath,
  );
  metadata.extensible_predicates.forEach((predicate) => {
    if (predicate.path.endsWith(".ql")) {
      toCopy.push(join(qlPackDetails.qlPackRootPath, predicate.path));
    }
  });

  [
    // also copy the lock file (either new name or old name) and the query file itself. These are not included in the packlist.
    ...QLPACK_LOCK_FILENAMES.map((f) => join(qlPackDetails.qlPackRootPath, f)),
    ...qlPackDetails.queryFiles,
  ].forEach((absolutePath) => {
    if (absolutePath) {
      toCopy.push(absolutePath);
    }
  });

  let copiedCount = 0;
  await copy(qlPackDetails.qlPackRootPath, targetPackPath, {
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

  void extLogger.log(`Copied ${copiedCount} files to ${targetPackPath}`);

  await fixPackFile(targetPackPath, qlPackDetails);
}

interface RemoteQueryTempDir {
  remoteQueryDir: DirectoryResult;
  queryPackDir: string;
  compiledPackDir: string;
  bundleFile: string;
}

async function createRemoteQueriesTempDirectory(): Promise<RemoteQueryTempDir> {
  const shortRemoteQueryDir = await dir({
    dir: tmpDir.name,
    unsafeCleanup: true,
  });
  // Expand 8.3 filenames here to work around a CLI bug where `codeql pack bundle` produces an empty
  // archive if the pack path contains any 8.3 components.
  const remoteQueryDir = {
    ...shortRemoteQueryDir,
    path: await expandShortPaths(shortRemoteQueryDir.path, extLogger),
  };
  const queryPackDir = join(remoteQueryDir.path, "query-pack");
  await mkdirp(queryPackDir);
  const compiledPackDir = join(remoteQueryDir.path, "compiled-pack");
  const bundleFile = await expandShortPaths(
    await getPackedBundlePath(tmpDir.name),
    extLogger,
  );
  return { remoteQueryDir, queryPackDir, compiledPackDir, bundleFile };
}

async function getPackedBundlePath(remoteQueryDir: string): Promise<string> {
  return tmpName({
    dir: remoteQueryDir,
    postfix: "generated.tgz",
    prefix: "qlpack",
  });
}

interface PreparedRemoteQuery {
  actionBranch: string;
  base64Pack: string;
  modelPacks: ModelPackDetails[];
  repoSelection: RepositorySelection;
  controllerRepo: Repository;
  queryStartTime: number;
}

export async function prepareRemoteQueryRun(
  cliServer: CodeQLCliServer,
  credentials: Credentials,
  qlPackDetails: QlPackDetails,
  progress: ProgressCallback,
  token: CancellationToken,
  dbManager: DbManager,
): Promise<PreparedRemoteQuery> {
  for (const queryFile of qlPackDetails.queryFiles) {
    if (!queryFile.endsWith(".ql")) {
      throw new UserCancellationException(
        `Not a CodeQL query file: ${queryFile}`,
      );
    }
  }

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

  const tempDir = await createRemoteQueriesTempDirectory();

  let generatedPack: GeneratedQlPackDetails;

  try {
    generatedPack = await generateQueryPack(
      cliServer,
      qlPackDetails,
      tempDir,
      token,
    );
  } finally {
    await tempDir.remoteQueryDir.cleanup();
  }

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

  return {
    actionBranch,
    base64Pack: generatedPack.base64Pack,
    modelPacks: generatedPack.modelPacks,
    repoSelection,
    controllerRepo,
    queryStartTime,
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
 * @param targetPackPath The path to the directory containing the target pack
 * @param qlPackDetails The details of the original QL pack
 */
async function fixPackFile(
  targetPackPath: string,
  qlPackDetails: QlPackDetails,
): Promise<void> {
  const packPath = await getQlPackFilePath(targetPackPath);

  // This should not happen since we create the pack ourselves.
  if (!packPath) {
    throw new Error(
      `Could not find ${QLPACK_FILENAMES.join(
        " or ",
      )} file in '${targetPackPath}'`,
    );
  }
  const qlpack = load(await readFile(packPath, "utf8")) as QlPackFile;

  updateDefaultSuite(qlpack, qlPackDetails);
  removeWorkspaceRefs(qlpack);

  await writeFile(packPath, dump(qlpack));
}

async function getExtensionPacksToInject(
  cliServer: CodeQLCliServer,
  workspaceFolders: string[],
): Promise<ModelPackDetails[]> {
  const result: ModelPackDetails[] = [];
  if (cliServer.useExtensionPacks()) {
    const extensionPacks = await cliServer.resolveQlpacks(
      workspaceFolders,
      true,
    );
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
      result.push({ name, path: paths[0] });
    });
  }

  return result;
}

async function addExtensionPacksAsDependencies(
  queryPackDir: string,
  extensionPacks: ModelPackDetails[],
): Promise<void> {
  const qlpackFile = await getQlPackFilePath(queryPackDir);
  if (!qlpackFile) {
    throw new Error(
      `Could not find ${QLPACK_FILENAMES.join(
        " or ",
      )} file in '${queryPackDir}'`,
    );
  }

  const syntheticQueryPack = load(
    await readFile(qlpackFile, "utf8"),
  ) as QlPackFile;

  const dependencies = syntheticQueryPack.dependencies ?? {};
  extensionPacks.forEach(({ name }) => {
    // Add this extension pack as a dependency. It doesn't matter which
    // version we specify, since we are guaranteed that the extension pack
    // is resolved from source at the given path.
    dependencies[name] = "*";
  });

  syntheticQueryPack.dependencies = dependencies;

  await writeFile(qlpackFile, dump(syntheticQueryPack));
}

function updateDefaultSuite(qlpack: QlPackFile, qlPackDetails: QlPackDetails) {
  delete qlpack.defaultSuiteFile;
  qlpack.defaultSuite = generateDefaultSuite(qlPackDetails);
}

function generateDefaultSuite(qlPackDetails: QlPackDetails) {
  const queries = qlPackDetails.queryFiles.map((query) => {
    const relativePath = relative(qlPackDetails.qlPackRootPath, query);
    return {
      query: relativePath.replace(/\\/g, "/"),
    };
  });
  return [
    {
      description: "Query suite for variant analysis",
    },
    ...queries,
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

function removeWorkspaceRefs(qlpack: QlPackFile) {
  if (!qlpack.dependencies) {
    return;
  }

  for (const [key, value] of Object.entries(qlpack.dependencies)) {
    if (value === "${workspace}") {
      qlpack.dependencies[key] = "*";
    }
  }
}
