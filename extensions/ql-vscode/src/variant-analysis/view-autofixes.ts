import type { RepositoriesFilterSortStateWithIds } from "./shared/variant-analysis-filter-sort";
import {
  defaultFilterSortState,
  filterAndSortRepositoriesWithResults,
} from "./shared/variant-analysis-filter-sort";
import type { VariantAnalysis } from "./shared/variant-analysis";
import type { Credentials } from "../common/authentication";
import type { NotificationLogger } from "../common/logging";
import type { App } from "../common/app";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import { pathExists, ensureDir } from "fs-extra";
import { withProgress, progressUpdate } from "../common/vscode/progress";
import type { ProgressCallback } from "../common/vscode/progress";
import { join, dirname, parse } from "path";
import { tryGetQueryMetadata } from "../codeql-cli/query-metadata";
import { window as Window } from "vscode";
import { pluralize } from "../common/word";
import { glob } from "glob";

// Limit to three repos when generating autofixes so not sending
// too many requests to autofix. Since we only need to validate
// a handle of autofixes for each query, this should be sufficient.
// Consider increasing this in the future if needed.
const MAX_NUM_REPOS: number = 3;

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
