import type { RepositoriesFilterSortStateWithIds } from "./shared/variant-analysis-filter-sort";
import {
  defaultFilterSortState,
  filterAndSortRepositoriesWithResults,
} from "./shared/variant-analysis-filter-sort";
import type {
  VariantAnalysis,
  VariantAnalysisRepositoryTask,
} from "./shared/variant-analysis";
import type { Credentials } from "../common/authentication";
import { extLogger } from "../common/logging/vscode";
import type { App } from "../common/app";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import {
  pathExists,
  ensureDir,
  remove,
  unlink,
  readFile,
  writeFile,
  createWriteStream,
} from "fs-extra";
import {
  withProgress,
  progressUpdate,
  reportStreamProgress,
} from "../common/vscode/progress";
import type { ProgressCallback } from "../common/vscode/progress";
import { join, parse } from "path";
import { pluralize } from "../common/word";
import { readRepoTask } from "./repo-tasks-store";
import { tmpDir } from "../tmp-dir";
import { spawn } from "child_process";
import type { execFileSync } from "child_process";
import { tryOpenExternalFile } from "../common/vscode/external-files";
import type { VariantAnalysisManager } from "./variant-analysis-manager";
import type { VariantAnalysisResultsManager } from "./variant-analysis-results-manager";
import {
  getAutofixPath,
  getAutofixModel,
  getAutofixCapiDevKey,
  downloadTimeout,
  AUTOFIX_PATH,
  AUTOFIX_MODEL,
  AUTOFIX_CAPI_DEV_KEY,
} from "../config";
import { asError, getErrorMessage } from "../common/helpers-pure";
import { createTimeoutSignal } from "../common/fetch-stream";
import { unzipToDirectoryConcurrently } from "../common/unzip-concurrently";
import { reportUnzipProgress } from "../common/vscode/unzip-progress";
import { getDirectoryNamesInsidePath } from "../common/files";
import { Readable } from "stream";

// Limit to three repos when generating autofixes so not sending
// too many requests to autofix. Since we only need to validate
// a handle of autofixes for each query, this should be sufficient.
// Consider increasing this in the future if needed.
const MAX_NUM_REPOS: number = 3;
// Similarly, limit to three fixes per repo.
const MAX_NUM_FIXES: number = 3;

/**
 * Generates autofixes for the results of a variant analysis.
 */
export async function viewAutofixesForVariantAnalysisResults(
  variantAnalysisManager: VariantAnalysisManager,
  variantAnalysisResultsManager: VariantAnalysisResultsManager,
  variantAnalysisId: number,
  filterSort: RepositoriesFilterSortStateWithIds = defaultFilterSortState,
  credentials: Credentials,
  app: App,
  cliServer: CodeQLCliServer,
): Promise<void> {
  await withProgress(
    async (progress: ProgressCallback) => {
      // Get the path to the local autofix installation.
      const localAutofixPath = await findLocalAutofix();

      // Get the variant analysis with the given id.
      const variantAnalysis =
        variantAnalysisManager.tryGetVariantAnalysis(variantAnalysisId);
      if (!variantAnalysis) {
        throw new Error(`No variant analysis with id: ${variantAnalysisId}`);
      }

      // Generate the query help and output it to the override directory.
      await overrideQueryHelp(variantAnalysis, cliServer, localAutofixPath);

      // Get the full names (nwos) of the selected repositories.
      const selectedRepoNames = getSelectedRepositoryNames(
        variantAnalysis,
        filterSort,
      );

      // Get storage paths for the autofix results.
      const {
        variantAnalysisIdStoragePath,
        sourceRootsStoragePath,
        autofixOutputStoragePath,
      } = await getStoragePaths(variantAnalysisManager, variantAnalysisId);

      // Process the selected repositories:
      //  Get sarif
      //  Download source root
      //  Run autofix and output results
      progress(
        progressUpdate(
          1,
          2,
          `Processing ${pluralize(selectedRepoNames.length, "repository", "repositories")}`,
        ),
      );
      const outputTextFiles = await processSelectedRepositories(
        variantAnalysisResultsManager,
        selectedRepoNames,
        variantAnalysisIdStoragePath,
        sourceRootsStoragePath,
        autofixOutputStoragePath,
        localAutofixPath,
        credentials,
      );

      // Output results from all repos to a combined markdown file.
      progress(progressUpdate(2, 2, `Finalizing autofix results`));
      const combinedOutputMarkdownFile = join(
        autofixOutputStoragePath,
        "autofix-output.md",
      );
      await mergeFiles(outputTextFiles, combinedOutputMarkdownFile, false);

      // Open the combined markdown file.
      await tryOpenExternalFile(app.commands, combinedOutputMarkdownFile);
    },
    {
      title: "Generating Autofixes",
      cancellable: false, // not cancellable for now
    },
  );
}

/**
 * Finds the local autofix installation path from the `codeQL.autofix.path` setting.
 * Throws an error if the path is not set or does not exist.
 * @returns An object containing the local autofix path.
 * @throws Error if the `codeQL.autofix.path` setting is not set or the path does not exist.
 */
async function findLocalAutofix(): Promise<string> {
  const localAutofixPath = getAutofixPath();
  if (!localAutofixPath) {
    throw new Error(
      `Path to local autofix installation not found. Make sure ${AUTOFIX_PATH.qualifiedName} is set correctly. Internal GitHub access required.`,
    );
  }
  if (!(await pathExists(localAutofixPath))) {
    throw new Error(`Local autofix path ${localAutofixPath} does not exist.`);
  }
  return localAutofixPath;
}

/**
 * Finds and resolves the Copilot API dev key from the `codeQL.autofix.capiDevKey` setting.
 * The key can be specified as an environment variable reference (e.g., `env:MY_ENV_VAR`)
 * or a 1Password secret reference (e.g., `op://vault/item/field`). By default, it uses
 * the environment variable `CAPI_DEV_KEY`.
 *
 * @returns The resolved Copilot API dev key.
 * @throws Error if the Copilot API dev key is not found or invalid.
 */
async function findCapiDevKey(): Promise<string> {
  let capiDevKey = getAutofixCapiDevKey() || "env:CAPI_DEV_KEY";

  if (!capiDevKey.startsWith("env:") && !capiDevKey.startsWith("op://")) {
    // Don't allow literal keys in config.json for security reasons
    throw new Error(
      `Invalid CAPI dev key format. Use 'env:<ENV_VAR_NAME>' or 'op://<1PASSWORD_SECRET_REFERENCE>'.`,
    );
  }
  if (capiDevKey.startsWith("env:")) {
    const envVarName = capiDevKey.substring("env:".length);
    capiDevKey = process.env[envVarName] || "";
  }
  if (capiDevKey.startsWith("op://")) {
    capiDevKey = await opRead(capiDevKey);
  }
  if (!capiDevKey) {
    throw new Error(
      `Copilot API dev key not found. Make sure ${AUTOFIX_CAPI_DEV_KEY.qualifiedName} is set correctly.`,
    );
  }
  return capiDevKey;
}

/**
 * Overrides the query help from a given variant analysis
 * at a location within the `localAutofixPath` directory .
 */
async function overrideQueryHelp(
  variantAnalysis: VariantAnalysis,
  cliServer: CodeQLCliServer,
  localAutofixPath: string,
): Promise<void> {
  // Get path to the query used by the variant analysis.
  const queryFilePath = variantAnalysis.query.filePath;
  if (!(await pathExists(queryFilePath))) {
    throw new Error(`Query file used by variant analysis not found.`);
  }
  const parsedQueryFilePath = parse(queryFilePath);
  const queryFilePathNoExt = join(
    parsedQueryFilePath.dir,
    parsedQueryFilePath.name,
  );

  // Get the path to the query help, which may be either a `.qhelp` or a `.md` file.
  // Note: we assume that the name of the query file is the same as the name of the query help file.
  const queryHelpFilePathQhelp = `${queryFilePathNoExt}.qhelp`;
  const queryHelpFilePathMarkdown = `${queryFilePathNoExt}.md`;

  // Set `queryHelpFilePath` to the existing extension type.
  let queryHelpFilePath: string;
  if (await pathExists(queryHelpFilePathQhelp)) {
    queryHelpFilePath = queryHelpFilePathQhelp;
  } else if (await pathExists(queryHelpFilePathMarkdown)) {
    queryHelpFilePath = queryHelpFilePathMarkdown;
  } else {
    throw new Error(
      `Could not find query help file at either ${queryHelpFilePathQhelp} or ${queryHelpFilePathMarkdown}. Check that the query help file exists and is named correctly.`,
    );
  }

  // Get the query metadata.
  let metadata;
  try {
    metadata = await cliServer.resolveMetadata(queryFilePath);
  } catch (e) {
    throw new Error(
      `Could not resolve query metadata for ${queryFilePath}. Reason: ${getErrorMessage(e)}`,
    );
  }
  // Get the query ID (used for the overridden query help's filename).
  const queryId = metadata.id;
  if (!queryId) {
    throw new Error(`Query metadata for ${queryFilePath} is missing an ID.`);
  }
  // Replace `/` with `-` for use with the overridden query help's filename.
  // Use `replaceAll` since some query IDs have multiple slashes.
  const queryIdWithDash = queryId.replaceAll("/", "-");

  // Get the path to the output directory for overriding the query help.
  // Note: the path to this directory may change in the future.
  const queryHelpOverrideDirectory = join(
    localAutofixPath,
    "pkg",
    "autofix",
    "prompt",
    "qhelps",
    `${queryIdWithDash}.md`,
  );

  await cliServer.generateQueryHelp(
    queryHelpFilePath,
    queryHelpOverrideDirectory,
  );
}

/**
 * Gets the full names (owner/repo) of the selected
 * repositories from the given variant analysis while
 * limiting the number of repositories to `MAX_NUM_REPOS`.
 */
function getSelectedRepositoryNames(
  variantAnalysis: VariantAnalysis,
  filterSort: RepositoriesFilterSortStateWithIds,
): string[] {
  // Get the repositories that were selected by the user.
  const filteredRepositories = filterAndSortRepositoriesWithResults(
    variantAnalysis.scannedRepos,
    filterSort,
  );

  // Get the full names (owner/repo = nwo) of the selected repos.
  let fullNames = filteredRepositories
    ?.filter((a) => a.resultCount && a.resultCount > 0)
    .map((a) => a.repository.fullName);
  if (!fullNames || fullNames.length === 0) {
    throw new Error("No repositories with results found.");
  }

  // Limit to MAX_NUM_REPOS by slicing the array.
  if (fullNames.length > MAX_NUM_REPOS) {
    fullNames = fullNames.slice(0, MAX_NUM_REPOS);
    void extLogger.showWarningMessage(
      `Only the first ${MAX_NUM_REPOS} repos (${fullNames.join(", ")}) will be included in the Autofix results.`,
    );
  }

  return fullNames;
}

/**
 * Gets the storage paths needed for the autofix results.
 */
async function getStoragePaths(
  variantAnalysisManager: VariantAnalysisManager,
  variantAnalysisId: number,
): Promise<{
  variantAnalysisIdStoragePath: string;
  sourceRootsStoragePath: string;
  autofixOutputStoragePath: string;
}> {
  // Confirm storage path for the variant analysis ID exists.
  const variantAnalysisIdStoragePath =
    variantAnalysisManager.getVariantAnalysisStorageLocation(variantAnalysisId);
  if (!(await pathExists(variantAnalysisIdStoragePath))) {
    throw new Error(
      `Variant analysis storage location does not exist: ${variantAnalysisIdStoragePath}`,
    );
  }

  // Storage path for all autofix info.
  const autofixStoragePath = join(variantAnalysisIdStoragePath, "autofix");

  // Storage path for the source roots used with autofix.
  const sourceRootsStoragePath = join(autofixStoragePath, "source-roots");
  await ensureDir(sourceRootsStoragePath);

  // Storage path for the autofix output.
  let autofixOutputStoragePath = join(autofixStoragePath, "output");
  // If the path already exists, assume that it's a previous run
  // and append "-n" to the end of the path where n is the next available number.
  if (await pathExists(autofixOutputStoragePath)) {
    let i = 1;
    while (await pathExists(autofixOutputStoragePath + i.toString())) {
      i++;
    }
    autofixOutputStoragePath = autofixOutputStoragePath += i.toString();
  }
  await ensureDir(autofixOutputStoragePath);

  return {
    variantAnalysisIdStoragePath,
    sourceRootsStoragePath,
    autofixOutputStoragePath,
  };
}

/**
 * Processes the selected repositories for autofix generation.
 */
async function processSelectedRepositories(
  variantAnalysisResultsManager: VariantAnalysisResultsManager,
  selectedRepoNames: string[],
  variantAnalysisIdStoragePath: string,
  sourceRootsStoragePath: string,
  autofixOutputStoragePath: string,
  localAutofixPath: string,
  credentials: Credentials,
): Promise<string[]> {
  const outputTextFiles: string[] = [];
  await Promise.all(
    selectedRepoNames.map(async (nwo) =>
      withProgress(
        async (progressForRepo: ProgressCallback) => {
          // Get the sarif file.
          progressForRepo(progressUpdate(1, 3, `Getting sarif...`));
          const sarifFile = await getRepoSarifFile(
            variantAnalysisResultsManager,
            variantAnalysisIdStoragePath,
            nwo,
          );

          // Read the contents of the variant analysis' `repo_task.json` file,
          // and confirm that the `databaseCommitSha` and `resultCount` exist.
          const repoTask: VariantAnalysisRepositoryTask = await readRepoTask(
            variantAnalysisResultsManager.getRepoStorageDirectory(
              variantAnalysisIdStoragePath,
              nwo,
            ),
          );
          if (!repoTask.databaseCommitSha) {
            throw new Error(`Missing database commit SHA for ${nwo}`);
          }
          if (!repoTask.resultCount) {
            throw new Error(`Missing variant analysis result count for ${nwo}`);
          }

          // Download the source root.
          // Using `0` as the progress step to force a dynamic vs static progress bar.
          progressForRepo(progressUpdate(0, 3, `Fetching source root...`));
          const srcRootPath = await downloadPublicCommitSource(
            nwo,
            repoTask.databaseCommitSha,
            sourceRootsStoragePath,
            credentials,
            progressForRepo,
          );

          // Run autofix.
          progressForRepo(progressUpdate(2, 3, `Running autofix...`));
          await runAutofixForRepository(
            nwo,
            sarifFile,
            srcRootPath,
            localAutofixPath,
            autofixOutputStoragePath,
            repoTask.resultCount,
            outputTextFiles,
          );
        },
        {
          title: `${nwo}`,
          cancellable: false,
        },
      ),
    ),
  );

  return outputTextFiles;
}

/**
 * Gets the path to a SARIF file for a given `nwo`.
 */
async function getRepoSarifFile(
  variantAnalysisResultsManager: VariantAnalysisResultsManager,
  variantAnalysisIdStoragePath: string,
  nwo: string,
): Promise<string> {
  if (
    !(await variantAnalysisResultsManager.isVariantAnalysisRepoDownloaded(
      variantAnalysisIdStoragePath,
      nwo,
    ))
  ) {
    throw new Error(`Variant analysis results not downloaded for ${nwo}`);
  }
  const sarifFile =
    variantAnalysisResultsManager.getRepoResultsSarifStoragePath(
      variantAnalysisIdStoragePath,
      nwo,
    );
  if (!(await pathExists(sarifFile))) {
    throw new Error(`SARIF file not found for ${nwo}`);
  }
  return sarifFile;
}

/**
 * Downloads the source code of a public commit from a GitHub repository.
 */
async function downloadPublicCommitSource(
  nwo: string,
  sha: string,
  outputPath: string,
  credentials: Credentials,
  progressCallback: ProgressCallback,
): Promise<string> {
  const [owner, repo] = nwo.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repository name: ${nwo}`);
  }

  // Create output directory if it doesn't exist
  await ensureDir(outputPath);

  // Define the final checkout directory
  const checkoutDir = join(
    outputPath,
    `${owner}-${repo}-${sha.substring(0, 7)}`,
  );

  // Check if directory already exists to avoid re-downloading
  if (await pathExists(checkoutDir)) {
    const dirNames = await getDirectoryNamesInsidePath(checkoutDir);
    if (dirNames.length === 1) {
      // The path to the source code should be a single directory inside `checkoutDir`.
      const sourceRootDir = join(checkoutDir, dirNames[0]);
      void extLogger.log(
        `Source for ${nwo} at ${sha} already exists at ${sourceRootDir}.`,
      );
      return sourceRootDir;
    } else {
      // Remove `checkoutDir` to allow a re-download if the directory structure is unexpected.
      void extLogger.log(
        `Unexpected directory structure. Removing ${checkoutDir}`,
      );
      await remove(checkoutDir);
    }
  }

  void extLogger.log(`Fetching source of repository ${nwo} at ${sha}...`);

  try {
    const octokit = await credentials.getOctokit();

    // Get the zipball URL
    const { url } = await octokit.rest.repos.downloadZipballArchive({
      owner,
      repo,
      ref: sha,
    });

    // Create a temporary directory for downloading
    const archivePath = join(
      tmpDir.name,
      `source-${owner}-${repo}-${Date.now()}.zip`,
    );

    // Set timeout
    const {
      signal,
      onData,
      dispose: disposeTimeout,
    } = createTimeoutSignal(downloadTimeout());

    // Fetch the url
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/zip",
        },
        signal,
      });
    } catch (e) {
      disposeTimeout();

      if (e instanceof DOMException && e.name === "AbortError") {
        const thrownError = new Error("The request timed out.");
        thrownError.stack = e.stack;
        throw thrownError;
      }
      throw new Error(
        `Error fetching source root. Reason: ${getErrorMessage(e)}`,
      );
    }

    // Download the source root from the response body
    const body = response.body;
    if (!body) {
      throw new Error("No response body found");
    }

    const archiveFileStream = createWriteStream(archivePath);

    const contentLength = response.headers.get("content-length");
    const totalNumBytes = contentLength
      ? parseInt(contentLength, 10)
      : undefined;

    const reportProgress = reportStreamProgress(
      "Downloading source root...",
      totalNumBytes,
      progressCallback,
    );

    try {
      const readable = Readable.fromWeb(body);
      readable.on("data", (chunk) => {
        onData();
        reportProgress(chunk?.length ?? 0);
      });
      await new Promise((resolve, reject) => {
        readable
          .pipe(archiveFileStream)
          .on("error", (err) => {
            reject(err);
          })
          .on("finish", () => resolve(undefined));
      });

      await new Promise((resolve, reject) => {
        archiveFileStream.close((err) => {
          if (err) {
            reject(err);
          }
          resolve(undefined);
        });
      });
    } catch (e) {
      // Close and remove the file if an error occurs
      archiveFileStream.close(() => {
        void remove(archivePath);
      });

      if (e instanceof DOMException && e.name === "AbortError") {
        const thrownError = new Error("The download timed out.");
        thrownError.stack = e.stack;
        throw thrownError;
      }

      throw new Error(
        `Error downloading source root. Reason: ${getErrorMessage(e)}`,
      );
    } finally {
      disposeTimeout();
    }

    void extLogger.log(`Download complete, extracting source...`);

    // Extract the downloaded zip file
    await unzipToDirectoryConcurrently(
      archivePath,
      checkoutDir,
      reportUnzipProgress(`Unzipping source root...`, progressCallback),
    );
    await remove(archivePath);

    // Since `unzipToDirectoryConcurrently` extracts to a directory within
    // `checkoutDir`, we need to return the path to that extracted directory.
    const dirNames = await getDirectoryNamesInsidePath(checkoutDir);
    if (dirNames.length === 1) {
      return join(checkoutDir, dirNames[0]);
    } else {
      throw new Error(
        `Expected exactly one unzipped source directory for ${nwo}, but found ${dirNames.length}.`,
      );
    }
  } catch (error) {
    await remove(checkoutDir);
    throw new Error(
      `Failed to download ${nwo} at ${sha}:. Reason: ${getErrorMessage(error)}`,
    );
  }
}

/**
 * Runs autofix for a given repository (nwo).
 */
async function runAutofixForRepository(
  nwo: string,
  sarifFile: string,
  srcRootPath: string,
  localAutofixPath: string,
  autofixOutputStoragePath: string,
  resultCount: number,
  outputTextFiles: string[],
): Promise<void> {
  // Get storage paths for the autofix results for this repository.
  const {
    repoAutofixOutputStoragePath,
    outputTextFilePath,
    transcriptFilePath,
    fixDescriptionFilePath,
  } = await getRepoStoragePaths(autofixOutputStoragePath, nwo);

  // Get autofix binary.
  // In the future, have user pass full path
  // in an environment variable instead of hardcoding part here.
  const autofixBin = join(process.cwd(), localAutofixPath, "bin", "autofix");

  // Limit number of fixes generated.
  const limitFixesBoolean: boolean = resultCount > MAX_NUM_FIXES;
  if (limitFixesBoolean) {
    void extLogger.log(
      `Only generating autofixes for the first ${MAX_NUM_FIXES} alerts for ${nwo}.`,
    );

    // Run autofix in a loop for the first MAX_NUM_FIXES alerts.
    // Not an ideal solution, but avoids modifying the input SARIF file.
    const tempOutputTextFiles: string[] = [];
    const fixDescriptionFiles: string[] = [];
    const transcriptFiles: string[] = [];
    for (let i = 0; i < MAX_NUM_FIXES; i++) {
      const tempOutputTextFilePath = appendSuffixToFilePath(
        outputTextFilePath,
        i.toString(),
      );
      const tempFixDescriptionFilePath = appendSuffixToFilePath(
        fixDescriptionFilePath,
        i.toString(),
      );
      const tempTranscriptFilePath = appendSuffixToFilePath(
        transcriptFilePath,
        i.toString(),
      );

      tempOutputTextFiles.push(tempOutputTextFilePath);
      fixDescriptionFiles.push(tempFixDescriptionFilePath);
      transcriptFiles.push(tempTranscriptFilePath);

      await runAutofixOnResults(
        autofixBin,
        sarifFile,
        srcRootPath,
        tempOutputTextFilePath,
        tempFixDescriptionFilePath,
        tempTranscriptFilePath,
        repoAutofixOutputStoragePath,
        i,
      );
    }

    // Merge the output files together.
    // Caveat that autofix will call each alert "alert 0", which will look a bit odd in the merged output file.
    await mergeFiles(tempOutputTextFiles, outputTextFilePath);
    await mergeFiles(fixDescriptionFiles, fixDescriptionFilePath);
    await mergeFiles(transcriptFiles, transcriptFilePath);
  } else {
    // Run autofix once for all alerts.
    await runAutofixOnResults(
      autofixBin,
      sarifFile,
      srcRootPath,
      outputTextFilePath,
      fixDescriptionFilePath,
      transcriptFilePath,
      repoAutofixOutputStoragePath,
    );
  }

  // Format the output text file with markdown.
  await formatWithMarkdown(outputTextFilePath, `${nwo}`);

  // Save output text files from each repo to later merge
  // into a single markdown file containing all results.
  outputTextFiles.push(outputTextFilePath);
}

/**
 * Gets the storage paths for the autofix results for a given repository.
 */
async function getRepoStoragePaths(
  autofixOutputStoragePath: string,
  nwo: string,
) {
  // Create output directories for repo's autofix results.
  const repoAutofixOutputStoragePath = join(
    autofixOutputStoragePath,
    nwo.replaceAll("/", "-"),
  );
  await ensureDir(repoAutofixOutputStoragePath);
  return {
    repoAutofixOutputStoragePath,
    outputTextFilePath: join(repoAutofixOutputStoragePath, "output.txt"),
    transcriptFilePath: join(repoAutofixOutputStoragePath, "transcript.md"),
    fixDescriptionFilePath: join(
      repoAutofixOutputStoragePath,
      "fix-description.md",
    ),
  };
}

/**
 * Runs autofix on the results in the given SARIF file.
 */
async function runAutofixOnResults(
  autofixBin: string,
  sarifFile: string,
  srcRootPath: string,
  outputTextFilePath: string,
  fixDescriptionFilePath: string,
  transcriptFilePath: string,
  workDir: string,
  alertNumber?: number, // Optional parameter for specific alert
): Promise<void> {
  // Get autofix model from user settings.
  const autofixModel = getAutofixModel();
  if (!autofixModel) {
    throw new Error(
      `Autofix model not found. Make sure ${AUTOFIX_MODEL.qualifiedName} is set correctly.`,
    );
  }
  // Set up args for autofix command.
  const autofixArgs = [
    "--sarif",
    sarifFile,
    "--source-root",
    srcRootPath,
    "--model",
    autofixModel,
    "--dev",
    "--no-cache",
    "--format",
    "text",
    "--diff-style",
    "diff", // could do "text" instead if want line of "=" between fixes
    "--output",
    outputTextFilePath,
    "--fix-description",
    fixDescriptionFilePath,
    "--transcript",
    transcriptFilePath,
  ];

  // Add alert number argument if provided
  if (alertNumber !== undefined) {
    autofixArgs.push("--only-alert-number", alertNumber.toString());
  }

  await execAutofix(
    autofixBin,
    autofixArgs,
    {
      cwd: workDir,
      env: {
        CAPI_DEV_KEY: await findCapiDevKey(),
        PATH: process.env.PATH,
      },
    },
    true,
  );
}

/**
 * Executes the autofix command.
 */
function execAutofix(
  bin: string,
  args: string[],
  options: Parameters<typeof execFileSync>[2],
  showCommand?: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const cwd = options?.cwd || process.cwd();
      if (showCommand) {
        void extLogger.log(
          `Spawning '${bin} ${args.join(" ")}' in ${cwd.toString()}`,
        );
      }

      let stdoutBuffer = "";
      let stderrBuffer = "";

      const p = spawn(bin, args, {
        stdio: ["ignore", "pipe", "pipe"],
        ...options,
      });

      // Listen for stdout
      p.stdout?.on("data", (data) => {
        stdoutBuffer += data.toString();
      });

      // Listen for stderr
      p.stderr?.on("data", (data) => {
        stderrBuffer += data.toString();
      });

      // Listen for errors
      p.on("error", reject);

      // Listen for process exit
      p.on("exit", (code) => {
        // Log collected output
        if (stdoutBuffer.trim()) {
          void extLogger.log(`Autofix stdout:\n${stdoutBuffer.trim()}`);
        }

        if (stderrBuffer.trim()) {
          void extLogger.log(`Autofix stderr:\n${stderrBuffer.trim()}`);
        }

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Autofix process exited with code ${code}.`));
        }
      });
    } catch (e) {
      reject(asError(e));
    }
  });
}

/** Execute the 1Password CLI command `op read <secretReference>`, if the `op` command exists on the PATH. */
async function opRead(secretReference: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const opProcess = spawn("op", ["read", secretReference], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";

    opProcess.stdout?.on("data", (data) => {
      stdoutBuffer += data.toString();
    });

    opProcess.stderr?.on("data", (data) => {
      stderrBuffer += data.toString();
    });

    opProcess.on("error", (error) => {
      reject(error);
    });

    opProcess.on("exit", (code) => {
      if (code === 0) {
        resolve(stdoutBuffer.trim());
      } else {
        reject(
          new Error(
            `1Password CLI exited with code ${code}. Stderr: ${stderrBuffer.trim()}`,
          ),
        );
      }
    });
  });
}

/**
 * Creates a new file path by appending the given suffix.
 * @param filePath The original file path.
 * @param suffix The suffix to append to the file name (before the extension).
 * @returns The new file path with the suffix appended.
 */
function appendSuffixToFilePath(filePath: string, suffix: string): string {
  const { dir, name, ext } = parse(filePath);
  return join(dir, `${name}-${suffix}${ext}`);
}

/**
 * Merges the given `inputFiles` into a single `outputFile`.
 * @param inputFiles - The list of input files to merge.
 * @param outputFile - The output file path.
 * @param deleteOriginalFiles - Whether to delete the original input files after merging.
 */
async function mergeFiles(
  inputFiles: string[],
  outputFile: string,
  deleteOriginalFiles: boolean = true,
): Promise<void> {
  try {
    // Check if any input files do not exist and return if so.
    const pathChecks = await Promise.all(
      inputFiles.map(async (path) => ({
        exists: await pathExists(path),
      })),
    );
    const anyPathMissing = pathChecks.some((check) => !check.exists);
    if (inputFiles.length === 0 || anyPathMissing) {
      return;
    }

    // Merge the files
    const contents = await Promise.all(
      inputFiles.map((file) => readFile(file, "utf8")),
    );

    // Write merged content
    await writeFile(outputFile, contents.join("\n"));

    // Delete original files
    if (deleteOriginalFiles) {
      await Promise.all(inputFiles.map((file) => unlink(file)));
    }
  } catch (error) {
    throw new Error(`Error merging files. Reason: ${getErrorMessage(error)}`);
  }
}

/**
 * Formats the given input file with the specified header.
 * @param inputFile The path to the input file to format.
 * @param header The header to include in the formatted output.
 */
async function formatWithMarkdown(
  inputFile: string,
  header: string,
): Promise<void> {
  try {
    // Check if the input file exists
    const exists = await pathExists(inputFile);
    if (!exists) {
      return;
    }

    // Read the input file content
    const content = await readFile(inputFile, "utf8");

    const frontFormatting: string =
      "<details><summary>Fix suggestion details</summary>\n\n```diff\n";

    const backFormatting: string =
      "```\n\n</details>\n\n ### Notes\n - notes placeholder\n\n";

    // Format the content with Markdown
    // Replace ``` in the content with \``` to avoid breaking the Markdown code block
    const formattedContent = `## ${header}\n\n${frontFormatting}${content.replaceAll("```", "\\```")}${backFormatting}`;

    // Write the formatted content back to the file
    await writeFile(inputFile, formattedContent);
  } catch (error) {
    throw new Error(`Error formatting file. Reason: ${getErrorMessage(error)}`);
  }
}
