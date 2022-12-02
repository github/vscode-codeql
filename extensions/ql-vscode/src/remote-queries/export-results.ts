import { join } from "path";
import { ensureDir, writeFile } from "fs-extra";

import {
  commands,
  ExtensionContext,
  Uri,
  ViewColumn,
  window,
  workspace,
} from "vscode";
import { Credentials } from "../authentication";
import { UserCancellationException } from "../commandRunner";
import { showInformationMessageWithAction } from "../helpers";
import { extLogger } from "../common";
import { QueryHistoryManager } from "../query-history";
import { createGist } from "./gh-api/gh-api-client";
import { RemoteQueriesManager } from "./remote-queries-manager";
import {
  generateMarkdown,
  generateVariantAnalysisMarkdown,
  MarkdownFile,
  RepositorySummary,
} from "./remote-queries-markdown-generation";
import { RemoteQuery } from "./remote-query";
import { AnalysisResults, sumAnalysesResults } from "./shared/analysis-result";
import { pluralize } from "../pure/word";
import { VariantAnalysisManager } from "./variant-analysis-manager";
import { assertNever } from "../pure/helpers-pure";
import {
  VariantAnalysis,
  VariantAnalysisScannedRepository,
  VariantAnalysisScannedRepositoryDownloadStatus,
  VariantAnalysisScannedRepositoryResult,
} from "./shared/variant-analysis";
import {
  filterAndSortRepositoriesWithResults,
  RepositoriesFilterSortStateWithIds,
} from "../pure/variant-analysis-filter-sort";

/**
 * Exports the results of the currently-selected remote query or variant analysis.
 */
export async function exportSelectedRemoteQueryResults(
  queryHistoryManager: QueryHistoryManager,
): Promise<void> {
  const queryHistoryItem = queryHistoryManager.getCurrentQueryHistoryItem();
  if (!queryHistoryItem || queryHistoryItem.t === "local") {
    throw new Error(
      "No variant analysis results currently open. To open results, click an item in the query history view.",
    );
  }

  if (queryHistoryItem.t === "remote") {
    return commands.executeCommand(
      "codeQL.exportRemoteQueryResults",
      queryHistoryItem.queryId,
    );
  } else if (queryHistoryItem.t === "variant-analysis") {
    return commands.executeCommand(
      "codeQL.exportVariantAnalysisResults",
      queryHistoryItem.variantAnalysis.id,
    );
  } else {
    assertNever(queryHistoryItem);
  }
}

/**
 * Exports the results of the given remote query.
 * The user is prompted to select the export format.
 */
export async function exportRemoteQueryResults(
  queryHistoryManager: QueryHistoryManager,
  remoteQueriesManager: RemoteQueriesManager,
  ctx: ExtensionContext,
  queryId: string,
): Promise<void> {
  const queryHistoryItem = queryHistoryManager.getRemoteQueryById(queryId);
  if (!queryHistoryItem) {
    void extLogger.log(`Could not find query with id ${queryId}`);
    throw new Error(
      "There was an error when trying to retrieve variant analysis information",
    );
  }

  if (!queryHistoryItem.completed) {
    throw new Error("Variant analysis results are not yet available.");
  }

  void extLogger.log(
    `Exporting variant analysis results for query: ${queryHistoryItem.queryId}`,
  );
  const query = queryHistoryItem.remoteQuery;
  const analysesResults = remoteQueriesManager.getAnalysesResults(
    queryHistoryItem.queryId,
  );

  const exportFormat = await determineExportFormat();
  if (!exportFormat) {
    return;
  }

  const exportDirectory =
    await queryHistoryManager.getQueryHistoryItemDirectory(queryHistoryItem);
  const exportedResultsDirectory = join(exportDirectory, "exported-results");

  await exportRemoteQueryAnalysisResults(
    ctx,
    exportedResultsDirectory,
    query,
    analysesResults,
    exportFormat,
  );
}

export async function exportRemoteQueryAnalysisResults(
  ctx: ExtensionContext,
  exportedResultsPath: string,
  query: RemoteQuery,
  analysesResults: AnalysisResults[],
  exportFormat: "gist" | "local",
) {
  const description = buildGistDescription(query, analysesResults);
  const markdownFiles = generateMarkdown(query, analysesResults, exportFormat);

  await exportResults(
    ctx,
    exportedResultsPath,
    description,
    markdownFiles,
    exportFormat,
  );
}

/**
 * Exports the results of the given or currently-selected remote query.
 * The user is prompted to select the export format.
 */
export async function exportVariantAnalysisResults(
  ctx: ExtensionContext,
  variantAnalysisManager: VariantAnalysisManager,
  variantAnalysisId: number,
  filterSort?: RepositoriesFilterSortStateWithIds,
): Promise<void> {
  const variantAnalysis = await variantAnalysisManager.getVariantAnalysis(
    variantAnalysisId,
  );
  if (!variantAnalysis) {
    void extLogger.log(
      `Could not find variant analysis with id ${variantAnalysisId}`,
    );
    throw new Error(
      "There was an error when trying to retrieve variant analysis information",
    );
  }

  const repoStates = await variantAnalysisManager.getRepoStates(
    variantAnalysisId,
  );

  void extLogger.log(
    `Exporting variant analysis results for variant analysis with id ${variantAnalysis.id}`,
  );

  const exportFormat = await determineExportFormat();
  if (!exportFormat) {
    return;
  }

  async function* getAnalysesResults(): AsyncGenerator<
    [VariantAnalysisScannedRepository, VariantAnalysisScannedRepositoryResult]
  > {
    if (!variantAnalysis) {
      return;
    }

    const repositories = filterAndSortRepositoriesWithResults(
      variantAnalysis.scannedRepos,
      filterSort,
    );
    if (!repositories) {
      return;
    }

    for (const repo of repositories) {
      const repoState = repoStates.find(
        (r) => r.repositoryId === repo.repository.id,
      );

      // Do not export if it has not yet completed or the download has not yet succeeded.
      if (
        repoState?.downloadStatus !==
        VariantAnalysisScannedRepositoryDownloadStatus.Succeeded
      ) {
        continue;
      }

      if (repo.resultCount == 0) {
        yield [
          repo,
          {
            variantAnalysisId: variantAnalysis.id,
            repositoryId: repo.repository.id,
          },
        ];
        continue;
      }

      const result = await variantAnalysisManager.loadResults(
        variantAnalysis.id,
        repo.repository.fullName,
        {
          skipCacheStore: true,
        },
      );

      yield [repo, result];
    }
  }

  const exportDirectory =
    variantAnalysisManager.getVariantAnalysisStorageLocation(
      variantAnalysis.id,
    );

  // The date will be formatted like the following: 20221115T123456Z. The time is in UTC.
  const formattedDate = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const exportedResultsDirectory = join(
    exportDirectory,
    "exported-results",
    `results_${formattedDate}`,
  );

  await exportVariantAnalysisAnalysisResults(
    ctx,
    exportedResultsDirectory,
    variantAnalysis,
    getAnalysesResults(),
    exportFormat,
  );
}

export async function exportVariantAnalysisAnalysisResults(
  ctx: ExtensionContext,
  exportedResultsPath: string,
  variantAnalysis: VariantAnalysis,
  analysesResults: AsyncIterable<
    [VariantAnalysisScannedRepository, VariantAnalysisScannedRepositoryResult]
  >,
  exportFormat: "gist" | "local",
) {
  const { markdownFiles, summaries } = await generateVariantAnalysisMarkdown(
    variantAnalysis,
    analysesResults,
    exportFormat,
  );
  const description = buildVariantAnalysisGistDescription(
    variantAnalysis,
    summaries,
  );

  await exportResults(
    ctx,
    exportedResultsPath,
    description,
    markdownFiles,
    exportFormat,
  );
}

/**
 * Determines the format in which to export the results, from the given export options.
 */
async function determineExportFormat(): Promise<"gist" | "local" | undefined> {
  const gistOption = {
    label: "$(ports-open-browser-icon) Create Gist (GitHub)",
  };
  const localMarkdownOption = {
    label: "$(markdown) Save as markdown",
  };

  const exportFormat = await window.showQuickPick(
    [gistOption, localMarkdownOption],
    {
      placeHolder: "Select export format",
      canPickMany: false,
      ignoreFocusOut: true,
    },
  );
  if (!exportFormat || !exportFormat.label) {
    throw new UserCancellationException("No export format selected", true);
  }

  if (exportFormat === gistOption) {
    return "gist";
  }
  if (exportFormat === localMarkdownOption) {
    return "local";
  }

  return undefined;
}

export async function exportResults(
  ctx: ExtensionContext,
  exportedResultsPath: string,
  description: string,
  markdownFiles: MarkdownFile[],
  exportFormat: "gist" | "local",
) {
  if (exportFormat === "gist") {
    await exportToGist(ctx, description, markdownFiles);
  } else if (exportFormat === "local") {
    await exportToLocalMarkdown(exportedResultsPath, markdownFiles);
  }
}

export async function exportToGist(
  ctx: ExtensionContext,
  description: string,
  markdownFiles: MarkdownFile[],
) {
  const credentials = await Credentials.initialize(ctx);

  // Convert markdownFiles to the appropriate format for uploading to gist
  const gistFiles = markdownFiles.reduce((acc, cur) => {
    acc[`${cur.fileName}.md`] = { content: cur.content.join("\n") };
    return acc;
  }, {} as { [key: string]: { content: string } });

  const gistUrl = await createGist(credentials, description, gistFiles);
  if (gistUrl) {
    const shouldOpenGist = await showInformationMessageWithAction(
      "Variant analysis results exported to gist.",
      "Open gist",
    );
    if (shouldOpenGist) {
      await commands.executeCommand("vscode.open", Uri.parse(gistUrl));
    }
  }
}

/**
 * Builds Gist description
 * Ex: Empty Block (Go) x results (y repositories)
 */
const buildGistDescription = (
  query: RemoteQuery,
  analysesResults: AnalysisResults[],
) => {
  const resultCount = sumAnalysesResults(analysesResults);
  const resultLabel = pluralize(resultCount, "result", "results");
  const repositoryLabel = query.repositoryCount
    ? `(${pluralize(query.repositoryCount, "repository", "repositories")})`
    : "";
  return `${query.queryName} (${query.language}) ${resultLabel} ${repositoryLabel}`;
};

/**
 * Builds Gist description
 * Ex: Empty Block (Go) x results (y repositories)
 */
const buildVariantAnalysisGistDescription = (
  variantAnalysis: VariantAnalysis,
  summaries: RepositorySummary[],
) => {
  const resultCount = summaries.reduce(
    (acc, summary) => acc + (summary.resultCount ?? 0),
    0,
  );
  const resultLabel = pluralize(resultCount, "result", "results");

  const repositoryLabel = summaries.length
    ? `(${pluralize(summaries.length, "repository", "repositories")})`
    : "";
  return `${variantAnalysis.query.name} (${variantAnalysis.query.language}) ${resultLabel} ${repositoryLabel}`;
};

/**
 * Saves the results of an exported query to local markdown files.
 */
async function exportToLocalMarkdown(
  exportedResultsPath: string,
  markdownFiles: MarkdownFile[],
) {
  await ensureDir(exportedResultsPath);
  for (const markdownFile of markdownFiles) {
    const filePath = join(exportedResultsPath, `${markdownFile.fileName}.md`);
    await writeFile(filePath, markdownFile.content.join("\n"), "utf8");
  }
  const shouldOpenExportedResults = await showInformationMessageWithAction(
    `Variant analysis results exported to \"${exportedResultsPath}\".`,
    "Open exported results",
  );
  if (shouldOpenExportedResults) {
    const summaryFilePath = join(exportedResultsPath, "_summary.md");
    const summaryFile = await workspace.openTextDocument(summaryFilePath);
    await window.showTextDocument(summaryFile, ViewColumn.One);
    await commands.executeCommand("revealFileInOS", Uri.file(summaryFilePath));
  }
}
