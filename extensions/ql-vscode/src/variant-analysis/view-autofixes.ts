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
import { pathExists } from "fs-extra";
import { withProgress, progressUpdate } from "../common/vscode/progress";
import type { ProgressCallback } from "../common/vscode/progress";
import { join, dirname, parse } from "path";
import { tryGetQueryMetadata } from "../codeql-cli/query-metadata";
import { window as Window } from "vscode";

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
