import { join } from "path";
import { ensureDir, writeFile } from "fs-extra";

import type { CancellationToken } from "vscode";
import { Uri, ViewColumn, window, workspace } from "vscode";
import type { ProgressCallback } from "../common/vscode/progress";
import {
  UserCancellationException,
  withProgress,
} from "../common/vscode/progress";
import { showInformationMessageWithAction } from "../common/vscode/dialog";
import { extLogger } from "../common/logging/vscode";
import { createGist } from "./gh-api/gh-api-client";
import type { MarkdownFile, RepositorySummary } from "./markdown-generation";
import { generateVariantAnalysisMarkdown } from "./markdown-generation";
import { pluralize } from "../common/word";
import type { VariantAnalysisManager } from "./variant-analysis-manager";
import type {
  VariantAnalysis,
  VariantAnalysisScannedRepository,
  VariantAnalysisScannedRepositoryResult,
} from "./shared/variant-analysis";
import { VariantAnalysisScannedRepositoryDownloadStatus } from "./shared/variant-analysis";
import type { RepositoriesFilterSortStateWithIds } from "./shared/variant-analysis-filter-sort";
import { filterAndSortRepositoriesWithResults } from "./shared/variant-analysis-filter-sort";
import type { Credentials } from "../common/authentication";
import type { AppCommandManager } from "../common/commands";

const MAX_VARIANT_ANALYSIS_EXPORT_PROGRESS_STEPS = 2;

/**
 * Exports the results of the given or currently-selected variant analysis.
 * The user is prompted to select the export format.
 */
export async function exportVariantAnalysisResults(
  variantAnalysisManager: VariantAnalysisManager,
  variantAnalysisId: number,
  filterSort: RepositoriesFilterSortStateWithIds | undefined,
  commandManager: AppCommandManager,
  credentials: Credentials,
): Promise<void> {
  await withProgress(
    async (progress: ProgressCallback, token: CancellationToken) => {
      const variantAnalysis =
        variantAnalysisManager.tryGetVariantAnalysis(variantAnalysisId);
      if (!variantAnalysis) {
        void extLogger.log(
          `Could not find variant analysis with id ${variantAnalysisId}`,
        );
        throw new Error(
          "There was an error when trying to retrieve variant analysis information",
        );
      }

      if (token.isCancellationRequested) {
        throw new UserCancellationException("Cancelled");
      }

      const repoStates =
        variantAnalysisManager.getRepoStates(variantAnalysisId);

      void extLogger.log(
        `Exporting variant analysis results for variant analysis with id ${variantAnalysis.id}`,
      );

      progress({
        maxStep: MAX_VARIANT_ANALYSIS_EXPORT_PROGRESS_STEPS,
        step: 0,
        message: "Determining export format",
      });

      const exportFormat = await determineExportFormat();
      if (!exportFormat) {
        return;
      }

      if (token.isCancellationRequested) {
        throw new UserCancellationException("Cancelled");
      }

      const repositories = filterAndSortRepositoriesWithResults(
        variantAnalysis.scannedRepos,
        filterSort,
      )?.filter(
        (repo) =>
          repo.resultCount &&
          repoStates.find((r) => r.repositoryId === repo.repository.id)
            ?.downloadStatus ===
            VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
      );

      async function* getAnalysesResults(): AsyncGenerator<
        [
          VariantAnalysisScannedRepository,
          VariantAnalysisScannedRepositoryResult,
        ]
      > {
        if (!variantAnalysis) {
          return;
        }

        if (!repositories) {
          return;
        }

        for (const repo of repositories) {
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
        exportedResultsDirectory,
        variantAnalysis,
        getAnalysesResults(),
        repositories?.length ?? 0,
        exportFormat,
        commandManager,
        credentials,
        progress,
        token,
      );
    },
    {
      title: "Exporting variant analysis results",
      cancellable: true,
    },
  );
}

async function exportVariantAnalysisAnalysisResults(
  exportedResultsPath: string,
  variantAnalysis: VariantAnalysis,
  analysesResults: AsyncIterable<
    [VariantAnalysisScannedRepository, VariantAnalysisScannedRepositoryResult]
  >,
  expectedAnalysesResultsCount: number,
  exportFormat: "gist" | "local",
  commandManager: AppCommandManager,
  credentials: Credentials,
  progress: ProgressCallback,
  token: CancellationToken,
) {
  if (token.isCancellationRequested) {
    throw new UserCancellationException("Cancelled");
  }

  progress({
    maxStep: MAX_VARIANT_ANALYSIS_EXPORT_PROGRESS_STEPS,
    step: 1,
    message: "Generating Markdown files",
  });

  const { markdownFiles, summaries } = await generateVariantAnalysisMarkdown(
    variantAnalysis,
    analysesResults,
    expectedAnalysesResultsCount,
    exportFormat,
  );
  const description = buildVariantAnalysisGistDescription(
    variantAnalysis,
    summaries,
  );

  await exportResults(
    exportedResultsPath,
    description,
    markdownFiles,
    exportFormat,
    commandManager,
    credentials,
    progress,
    token,
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

async function exportResults(
  exportedResultsPath: string,
  description: string,
  markdownFiles: MarkdownFile[],
  exportFormat: "gist" | "local",
  commandManager: AppCommandManager,
  credentials: Credentials,
  progress?: ProgressCallback,
  token?: CancellationToken,
) {
  if (token?.isCancellationRequested) {
    throw new UserCancellationException("Cancelled");
  }

  if (exportFormat === "gist") {
    await exportToGist(
      description,
      markdownFiles,
      commandManager,
      credentials,
      progress,
      token,
    );
  } else if (exportFormat === "local") {
    await exportToLocalMarkdown(
      exportedResultsPath,
      markdownFiles,
      commandManager,
      progress,
      token,
    );
  }
}

async function exportToGist(
  description: string,
  markdownFiles: MarkdownFile[],
  commandManager: AppCommandManager,
  credentials: Credentials,
  progress?: ProgressCallback,
  token?: CancellationToken,
) {
  progress?.({
    maxStep: MAX_VARIANT_ANALYSIS_EXPORT_PROGRESS_STEPS,
    step: 2,
    message: "Creating Gist",
  });

  if (token?.isCancellationRequested) {
    throw new UserCancellationException("Cancelled");
  }

  // Convert markdownFiles to the appropriate format for uploading to gist
  const gistFiles = markdownFiles.reduce(
    (acc, cur) => {
      acc[`${cur.fileName}.md`] = { content: cur.content.join("\n") };
      return acc;
    },
    {} as { [key: string]: { content: string } },
  );

  const gistUrl = await createGist(credentials, description, gistFiles);
  if (gistUrl) {
    // This needs to use .then to ensure we aren't keeping the progress notification open. We shouldn't await the
    // "Open gist" button click.
    void showInformationMessageWithAction(
      "Variant analysis results exported to gist.",
      "Open gist",
    ).then((shouldOpenGist) => {
      if (!shouldOpenGist) {
        return;
      }
      return commandManager.execute("vscode.open", Uri.parse(gistUrl));
    });
  }
}

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
  return `${variantAnalysis.query.name} (${variantAnalysis.language}) ${resultLabel} ${repositoryLabel}`;
};

/**
 * Saves the results of an exported query to local markdown files.
 */
async function exportToLocalMarkdown(
  exportedResultsPath: string,
  markdownFiles: MarkdownFile[],
  commandManager: AppCommandManager,
  progress?: ProgressCallback,
  token?: CancellationToken,
) {
  if (token?.isCancellationRequested) {
    throw new UserCancellationException("Cancelled");
  }

  progress?.({
    maxStep: MAX_VARIANT_ANALYSIS_EXPORT_PROGRESS_STEPS,
    step: 2,
    message: "Creating local Markdown files",
  });

  await ensureDir(exportedResultsPath);
  for (const markdownFile of markdownFiles) {
    const filePath = join(exportedResultsPath, `${markdownFile.fileName}.md`);
    await writeFile(filePath, markdownFile.content.join("\n"), "utf8");
  }

  // This needs to use .then to ensure we aren't keeping the progress notification open. We shouldn't await the
  // "Open exported results" button click.
  void showInformationMessageWithAction(
    `Variant analysis results exported to "${exportedResultsPath}".`,
    "Open exported results",
  ).then(async (shouldOpenExportedResults) => {
    if (!shouldOpenExportedResults) {
      return;
    }

    const summaryFilePath = join(exportedResultsPath, "_summary.md");
    const summaryFile = await workspace.openTextDocument(summaryFilePath);
    await window.showTextDocument(summaryFile, ViewColumn.One);
    await commandManager.execute("revealFileInOS", Uri.file(summaryFilePath));
  });
}
