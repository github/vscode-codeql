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
import type { NotificationLogger } from "../common/logging";
import type { App } from "../common/app";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import { pathExists, ensureDir, readdir, move, remove } from "fs-extra";
import { withProgress, progressUpdate } from "../common/vscode/progress";
import type { ProgressCallback } from "../common/vscode/progress";
import { join, dirname, parse } from "path";
import { tryGetQueryMetadata } from "../codeql-cli/query-metadata";
import { window as Window } from "vscode";
import { pluralize } from "../common/word";
import { glob } from "glob";
import { readRepoTask } from "./repo-tasks-store";
import { unlink, mkdtemp, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { spawn } from "child_process";
import type { execFileSync } from "child_process";

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
  variantAnalysisId: number,
  filterSort: RepositoriesFilterSortStateWithIds = defaultFilterSortState,
  variantAnalyses: Map<number, VariantAnalysis>,
  credentials: Credentials,
  logger: NotificationLogger,
  storagePath: string,
  app: App,
  cliServer: CodeQLCliServer,
): Promise<void> {
  await withProgress(
    async (progress: ProgressCallback) => {
      // Get the path to the local autofix installation.
      progress(progressUpdate(1, 4, `Checking for local autofix installation`));
      const localAutofixPath = findLocalAutofix();

      // Get the variant analysis with the given id.
      const variantAnalysis = variantAnalyses.get(variantAnalysisId);
      if (!variantAnalysis) {
        throw new Error(`No variant analysis with id: ${variantAnalysisId}`);
      }

      // Generate the query help and output it to the override directory.
      progress(progressUpdate(2, 4, `Generating query help override`));
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
      } = await getStoragePaths(variantAnalysisId, storagePath);

      // Process the selected repositories:
      //  Get sarif
      //  Download source root
      //  Run autofix and output results
      progress(
        progressUpdate(
          3,
          4,
          `Processing ${pluralize(selectedRepoNames.length, "repository", "repositories")}`,
        ),
      );
      const outputTextFiles = await processSelectedRepositories(
        selectedRepoNames,
        variantAnalysisIdStoragePath,
        sourceRootsStoragePath,
        autofixOutputStoragePath,
        localAutofixPath,
        credentials,
        logger,
      );

      // TODO
    },
    {
      title: "Generating Autofixes",
      cancellable: false, // not cancellable for now
    },
  );
}

/**
 * Finds the local autofix installation path from the AUTOFIX_PATH environment variable.
 * Throws an error if the path is not set or does not exist.
 * @returns An object containing the local autofix path.
 * @throws Error if the AUTOFIX_PATH environment variable is not set or the path does not exist.
 */
function findLocalAutofix(): string {
  const localAutofixPath = process.env.AUTOFIX_PATH;
  if (!localAutofixPath) {
    throw new Error("Path to local autofix installation not found.");
  }
  if (!pathExists(localAutofixPath)) {
    throw new Error(`Local autofix path ${localAutofixPath} does not exist.`);
  }
  return localAutofixPath;
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
  const queryFilePathNoExt = join(
    dirname(queryFilePath),
    parse(queryFilePath).name,
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
  const metadata = await tryGetQueryMetadata(cliServer, queryFilePath);
  if (!metadata) {
    throw new Error(`Could not get query metadata for ${queryFilePath}.`);
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
    "prompt-templates",
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

  // Limit to MAX_NUM_REPOS by slicing the array,
  // and inform the user about the limit.
  if (fullNames.length > MAX_NUM_REPOS) {
    fullNames = fullNames.slice(0, MAX_NUM_REPOS);
    void Window.showInformationMessage(
      `Only the first ${MAX_NUM_REPOS} repos (${fullNames.join(", ")}) will be included in the Autofix results.`,
    );
  }

  return fullNames;
}

/**
 * Gets the storage paths needed for the autofix results.
 */
async function getStoragePaths(
  variantAnalysisId: number,
  storagePath: string,
): Promise<{
  variantAnalysisIdStoragePath: string;
  sourceRootsStoragePath: string;
  autofixOutputStoragePath: string;
}> {
  // Confirm storage path for the variant analysis ID exists.
  const variantAnalysisIdStoragePath = join(
    storagePath,
    variantAnalysisId.toString(),
  );
  if (!(await pathExists(variantAnalysisIdStoragePath))) {
    throw new Error(
      `Variant analysis storage path does not exist: ${variantAnalysisIdStoragePath}`,
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
  selectedRepoNames: string[],
  variantAnalysisIdStoragePath: string,
  sourceRootsStoragePath: string,
  autofixOutputStoragePath: string,
  localAutofixPath: string,
  credentials: Credentials,
  logger: NotificationLogger,
): Promise<string[]> {
  const outputTextFiles: string[] = [];
  await Promise.all(
    selectedRepoNames.map(async (nwo) =>
      withProgress(
        async (progressForRepo: ProgressCallback) => {
          // Get the sarif file.
          progressForRepo(progressUpdate(1, 3, `Getting sarif`));
          const repoStoragePath = join(variantAnalysisIdStoragePath, nwo);
          const sarifFile = await getSarifFile(repoStoragePath, nwo);

          // Read the contents of the variant analysis' `repo_task.json` file,
          // and confirm that the `databaseCommitSha` and `resultCount` exist.
          const repoTask: VariantAnalysisRepositoryTask =
            await readRepoTask(repoStoragePath);
          if (!repoTask.databaseCommitSha) {
            throw new Error(`Missing database commit SHA for ${nwo}`);
          }
          if (!repoTask.resultCount) {
            throw new Error(`Missing variant analysis result count for ${nwo}`);
          }

          // Download the source root.
          // Using `0` as the progress step to force a dynamic vs static progress bar.
          // Consider using `reportStreamProgress` as a future enhancement.
          progressForRepo(progressUpdate(0, 3, `Downloading source root`));
          const srcRootPath = await downloadPublicCommitSource(
            nwo,
            repoTask.databaseCommitSha,
            sourceRootsStoragePath,
            credentials,
            logger,
          );

          // Run autofix.
          progressForRepo(progressUpdate(2, 3, `Running autofix`));
          await runAutofixForRepository(
            nwo,
            sarifFile,
            srcRootPath,
            localAutofixPath,
            autofixOutputStoragePath,
            repoTask.resultCount,
            logger,
            outputTextFiles,
          );
        },
        {
          title: `Processing ${nwo}`,
          cancellable: false,
        },
      ),
    ),
  );

  return outputTextFiles;
}

/**
 * Gets the path to a SARIF file in a given `repoStoragePath`.
 */
async function getSarifFile(
  repoStoragePath: string,
  nwo: string,
): Promise<string> {
  // Get results directory path.
  const repoResultsStoragePath = join(repoStoragePath, "results");
  // Find sarif file.
  const sarifFiles = await glob(`${repoResultsStoragePath}/**/*.sarif`);
  if (sarifFiles.length !== 1) {
    throw new Error(
      `Expected to find exactly one \`*.sarif\` file for ${nwo}, but found ${sarifFiles.length}.`,
    );
  }
  return sarifFiles[0];
}

/**
 * Downloads the source code of a public commit from a GitHub repository.
 */
async function downloadPublicCommitSource(
  nwo: string,
  sha: string,
  outputPath: string,
  credentials: Credentials,
  logger: NotificationLogger,
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
    void logger.log(
      `Source for ${nwo} at ${sha} already exists at ${checkoutDir}.`,
    );
    return checkoutDir;
  }

  void logger.log(`Fetching source of repository ${nwo} at ${sha}...`);

  try {
    // Create a temporary directory for downloading
    const downloadDir = await mkdtemp(join(tmpdir(), "download-source-"));
    const tarballPath = join(downloadDir, "source.tar.gz");

    const octokit = await credentials.getOctokit();

    // Get the tarball URL
    const { url } = await octokit.rest.repos.downloadTarballArchive({
      owner,
      repo,
      ref: sha,
    });

    // Download the tarball using spawn
    await new Promise<void>((resolve, reject) => {
      const curlArgs = [
        "-H",
        "Accept: application/octet-stream",
        "--user-agent",
        "GitHub-CodeQL-Extension",
        "-L", // Follow redirects
        "-o",
        tarballPath,
        url,
      ];

      const process = spawn("curl", curlArgs, { cwd: downloadDir });

      process.on("error", reject);
      process.on("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`curl exited with code ${code}`)),
      );
    });

    void logger.log(`Download complete, extracting source...`);

    // Extract the tarball
    await new Promise<void>((resolve, reject) => {
      const process = spawn("tar", ["-xzf", tarballPath], { cwd: downloadDir });

      process.on("error", reject);
      process.on("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`tar extraction failed with code ${code}`)),
      );
    });

    // Remove the tarball to save space
    await unlink(tarballPath);

    // Find the extracted directory (GitHub tarballs extract to a single directory)
    const extractedFiles = await readdir(downloadDir);
    const sourceDir = extractedFiles.filter((f) => f !== "source.tar.gz")[0];

    if (!sourceDir) {
      throw new Error("Failed to find extracted source directory");
    }

    const extractedSourcePath = join(downloadDir, sourceDir);

    // Ensure the destination directory's parent exists
    await ensureDir(dirname(checkoutDir));

    // Move the extracted source to the final location
    await move(extractedSourcePath, checkoutDir);

    // Clean up the temporary directory
    await remove(downloadDir);

    return checkoutDir;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to download ${nwo} at ${sha}: ${errorMessage}`);
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
  logger: NotificationLogger,
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
  // Switch to Go binary in the future and have user pass full path
  // in an environment variable instead of hardcoding part here.
  const cocofixBin = join(process.cwd(), localAutofixPath, "bin", "cocofix.js");

  // Limit number of fixes generated.
  const limitFixesBoolean: boolean = resultCount > MAX_NUM_FIXES;
  if (limitFixesBoolean) {
    void Window.showInformationMessage(
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
        logger,
        cocofixBin,
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
      logger,
      cocofixBin,
      sarifFile,
      srcRootPath,
      outputTextFilePath,
      fixDescriptionFilePath,
      transcriptFilePath,
      repoAutofixOutputStoragePath,
    );
  }

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
  logger: NotificationLogger,
  cocofixBin: string,
  sarifFile: string,
  srcRootPath: string,
  outputTextFilePath: string,
  fixDescriptionFilePath: string,
  transcriptFilePath: string,
  workDir: string,
  alertNumber?: number, // Optional parameter for specific alert
): Promise<void> {
  // Set up args for autofix command.
  const fixedAutofixArgs = [
    "--sarif",
    sarifFile,
    "--source-root",
    srcRootPath,
    "--model",
    "capi-dev-4o", // may fail with older versions of cocofix
    "--dev",
    "--no-cache",
    "--format",
    "text",
    "--diff-style",
    "diff", // could do "text" instead if want line of "=" between fixes
  ];
  const varAutofixArgs = createVarAutofixArgs(
    outputTextFilePath,
    fixDescriptionFilePath,
    transcriptFilePath,
    alertNumber,
  );

  const autofixArgs = [...fixedAutofixArgs, ...varAutofixArgs];

  await execAutofix(
    logger,
    cocofixBin,
    autofixArgs,
    {
      cwd: workDir,
      env: {
        CAPI_DEV_KEY: process.env.CAPI_DEV_KEY,
        PATH: process.env.PATH,
      },
    },
    true,
  );
}

/**
 * Creates autofix arguments that vary depending on the run.
 */
function createVarAutofixArgs(
  outputTextFilePath: string,
  fixDescriptionFilePath: string,
  transcriptFilePath: string,
  alertNumber?: number, // Optional parameter for specific alert
): string[] {
  const args = [
    "--output",
    outputTextFilePath,
    "--fix-description",
    fixDescriptionFilePath,
    "--transcript",
    transcriptFilePath,
  ];

  // Add alert number argument if provided
  if (alertNumber !== undefined) {
    args.push("--only-alert-number", alertNumber.toString());
  }

  return args;
}

/**
 * Executes the autofix command.
 */
function execAutofix(
  logger: NotificationLogger,
  bin: string,
  args: string[],
  options: Parameters<typeof execFileSync>[2],
  showCommand?: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const cwd = options?.cwd || process.cwd();
      if (showCommand) {
        void logger.log(`Spawning '${bin} ${args.join(" ")}' in ${cwd}`);
      }
      if (args.some((a) => a === undefined || a === "")) {
        throw new Error(
          `Invalid empty or undefined arguments: ${args.join(" ")}`,
        );
      }
      const p = spawn(bin, args, { stdio: [0, 1, 2], ...options });
      p.on("error", reject);
      p.on("exit", (code) => (code === 0 ? resolve() : reject(code)));
    } catch (e) {
      reject(e);
    }
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
    console.error("Error merging files:", error);
    throw error;
  }
}
