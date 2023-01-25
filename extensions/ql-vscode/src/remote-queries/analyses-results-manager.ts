import { pathExists } from "fs-extra";
import { EOL } from "os";
import { extname } from "path";
import { CancellationToken } from "vscode";

import { Logger } from "../common";
import { downloadArtifactFromLink } from "./gh-api/gh-actions-api-client";
import { AnalysisSummary } from "./shared/remote-query-result";
import {
  AnalysisResults,
  AnalysisAlert,
  AnalysisRawResults,
} from "./shared/analysis-result";
import { UserCancellationException } from "../commandRunner";
import { sarifParser } from "../sarif-parser";
import { extractAnalysisAlerts } from "./sarif-processing";
import { CodeQLCliServer } from "../cli";
import { extractRawResults } from "./bqrs-processing";
import { asyncFilter, getErrorMessage } from "../pure/helpers-pure";
import { createDownloadPath } from "./download-link";
import { App } from "../common/app";

export class AnalysesResultsManager {
  // Store for the results of various analyses for each remote query.
  // The key is the queryId and is also the name of the directory where results are stored.
  private readonly analysesResults: Map<string, AnalysisResults[]>;

  constructor(
    private readonly app: App,
    private readonly cliServer: CodeQLCliServer,
    readonly storagePath: string,
    private readonly logger: Logger,
  ) {
    this.analysesResults = new Map();
  }

  public async downloadAnalysisResults(
    analysisSummary: AnalysisSummary,
    publishResults: (analysesResults: AnalysisResults[]) => Promise<void>,
  ): Promise<void> {
    if (this.isAnalysisInMemory(analysisSummary)) {
      // We already have the results for this analysis in memory, don't download again.
      return;
    }

    void this.logger.log(
      `Downloading and processing results for ${analysisSummary.nwo}`,
    );

    await this.downloadSingleAnalysisResults(analysisSummary, publishResults);
  }

  /**
   * Loads the array analysis results. For each analysis results, if it is not downloaded yet,
   * it will be downloaded. If it is already downloaded, it will be loaded into memory.
   * If it is already in memory, this will be a no-op.
   *
   * @param allAnalysesToLoad List of analyses to ensure are downloaded and in memory
   * @param token Optional cancellation token
   * @param publishResults Optional function to publish the results after loading
   */
  public async loadAnalysesResults(
    allAnalysesToLoad: AnalysisSummary[],
    token?: CancellationToken,
    publishResults: (
      analysesResults: AnalysisResults[],
    ) => Promise<void> = () => Promise.resolve(),
  ): Promise<void> {
    // Filter out analyses that we have already in memory.
    const analysesToDownload = allAnalysesToLoad.filter(
      (x) => !this.isAnalysisInMemory(x),
    );

    void this.logger.log("Downloading and processing analyses results");

    const batchSize = 3;
    const numOfBatches = Math.ceil(analysesToDownload.length / batchSize);
    const allFailures = [];

    for (let i = 0; i < analysesToDownload.length; i += batchSize) {
      if (token?.isCancellationRequested) {
        throw new UserCancellationException(
          "Downloading of analyses results has been cancelled",
          true,
        );
      }

      const batch = analysesToDownload.slice(i, i + batchSize);
      const batchTasks = batch.map((analysis) =>
        this.downloadSingleAnalysisResults(analysis, publishResults),
      );

      const nwos = batch.map((a) => a.nwo).join(", ");
      void this.logger.log(
        `Downloading batch ${
          Math.floor(i / batchSize) + 1
        } of ${numOfBatches} (${nwos})`,
      );

      const taskResults = await Promise.allSettled(batchTasks);
      const failedTasks = taskResults.filter(
        (x) => x.status === "rejected",
      ) as PromiseRejectedResult[];
      if (failedTasks.length > 0) {
        const failures = failedTasks.map((t) => t.reason.message);
        failures.forEach((f) => void this.logger.log(f));
        allFailures.push(...failures);
      }
    }

    if (allFailures.length > 0) {
      throw Error(allFailures.join(EOL));
    }
  }

  public getAnalysesResults(queryId: string): AnalysisResults[] {
    return [...this.internalGetAnalysesResults(queryId)];
  }

  private internalGetAnalysesResults(queryId: string): AnalysisResults[] {
    return this.analysesResults.get(queryId) || [];
  }

  public removeAnalysesResults(queryId: string) {
    this.analysesResults.delete(queryId);
  }

  private async downloadSingleAnalysisResults(
    analysis: AnalysisSummary,
    publishResults: (analysesResults: AnalysisResults[]) => Promise<void>,
  ): Promise<void> {
    const analysisResults: AnalysisResults = {
      nwo: analysis.nwo,
      status: "InProgress",
      interpretedResults: [],
      resultCount: analysis.resultCount,
      starCount: analysis.starCount,
      lastUpdated: analysis.lastUpdated,
    };
    const queryId = analysis.downloadLink.queryId;
    const resultsForQuery = this.internalGetAnalysesResults(queryId);
    resultsForQuery.push(analysisResults);
    this.analysesResults.set(queryId, resultsForQuery);
    void publishResults([...resultsForQuery]);
    const pos = resultsForQuery.length - 1;

    let artifactPath;
    try {
      artifactPath = await downloadArtifactFromLink(
        this.app.credentials,
        this.storagePath,
        analysis.downloadLink,
      );
    } catch (e) {
      throw new Error(
        `Could not download the analysis results for ${
          analysis.nwo
        }: ${getErrorMessage(e)}`,
      );
    }

    const fileLinkPrefix = this.createGitHubDotcomFileLinkPrefix(
      analysis.nwo,
      analysis.databaseSha,
    );

    let newAnaysisResults: AnalysisResults;
    const fileExtension = extname(artifactPath);
    if (fileExtension === ".sarif") {
      const queryResults = await this.readSarifResults(
        artifactPath,
        fileLinkPrefix,
      );
      newAnaysisResults = {
        ...analysisResults,
        interpretedResults: queryResults,
        status: "Completed",
      };
    } else if (fileExtension === ".bqrs") {
      const queryResults = await this.readBqrsResults(
        artifactPath,
        fileLinkPrefix,
        analysis.sourceLocationPrefix,
      );
      newAnaysisResults = {
        ...analysisResults,
        rawResults: queryResults,
        status: "Completed",
      };
    } else {
      void this.logger.log(
        `Cannot download results. File type '${fileExtension}' not supported.`,
      );
      newAnaysisResults = {
        ...analysisResults,
        status: "Failed",
      };
    }
    resultsForQuery[pos] = newAnaysisResults;
    void publishResults([...resultsForQuery]);
  }

  public async loadDownloadedAnalyses(allAnalysesToCheck: AnalysisSummary[]) {
    // Find all analyses that are already downloaded.
    const allDownloadedAnalyses = await asyncFilter(allAnalysesToCheck, (x) =>
      this.isAnalysisDownloaded(x),
    );
    // Now, ensure that all of these analyses are in memory. Some may already be in memory. These are ignored.
    await this.loadAnalysesResults(allDownloadedAnalyses);
  }

  private async isAnalysisDownloaded(
    analysis: AnalysisSummary,
  ): Promise<boolean> {
    return await pathExists(
      createDownloadPath(this.storagePath, analysis.downloadLink),
    );
  }

  private async readBqrsResults(
    filePath: string,
    fileLinkPrefix: string,
    sourceLocationPrefix: string,
  ): Promise<AnalysisRawResults> {
    return await extractRawResults(
      this.cliServer,
      this.logger,
      filePath,
      fileLinkPrefix,
      sourceLocationPrefix,
    );
  }

  private async readSarifResults(
    filePath: string,
    fileLinkPrefix: string,
  ): Promise<AnalysisAlert[]> {
    const sarifLog = await sarifParser(filePath);

    const processedSarif = extractAnalysisAlerts(sarifLog, fileLinkPrefix);
    if (processedSarif.errors.length) {
      void this.logger.log(
        `Error processing SARIF file: ${EOL}${processedSarif.errors.join(EOL)}`,
      );
    }

    return processedSarif.alerts;
  }

  private isAnalysisInMemory(analysis: AnalysisSummary): boolean {
    return this.internalGetAnalysesResults(analysis.downloadLink.queryId).some(
      (x) => x.nwo === analysis.nwo,
    );
  }

  private createGitHubDotcomFileLinkPrefix(nwo: string, sha: string): string {
    return `https://github.com/${nwo}/blob/${sha}`;
  }
}
