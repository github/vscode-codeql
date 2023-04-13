import { appendFile, pathExists } from "fs-extra";
import fetch from "node-fetch";
import { EOL } from "os";
import { join } from "path";

import { Logger } from "../common";
import { AnalysisAlert, AnalysisRawResults } from "./shared/analysis-result";
import { sarifParser } from "../sarif-parser";
import { extractAnalysisAlerts } from "./sarif-processing";
import { CodeQLCliServer } from "../cli";
import { extractRawResults } from "./bqrs-processing";
import {
  VariantAnalysis,
  VariantAnalysisRepositoryTask,
  VariantAnalysisScannedRepositoryResult,
} from "./shared/variant-analysis";
import { DisposableObject, DisposeHandler } from "../pure/disposable-object";
import { EventEmitter } from "vscode";
import { unzipFile } from "../pure/zip";
import {
  readRepoTask,
  writeRepoTask,
} from "./repo-tasks-store/repo-task-store";

type CacheKey = `${number}/${string}`;

const createCacheKey = (
  variantAnalysisId: number,
  repositoryFullName: string,
): CacheKey => `${variantAnalysisId}/${repositoryFullName}`;

export type ResultDownloadedEvent = {
  variantAnalysisId: number;
  repoTask: VariantAnalysisRepositoryTask;
};

export type LoadResultsOptions = {
  // If true, when results are loaded from storage, they will not be stored in the cache. This reduces memory usage if
  // results are only needed temporarily (e.g. for exporting results to a different format).
  skipCacheStore?: boolean;
};

export class VariantAnalysisResultsManager extends DisposableObject {
  private static readonly RESULTS_DIRECTORY = "results";

  private readonly cachedResults: Map<
    CacheKey,
    VariantAnalysisScannedRepositoryResult
  >;

  private readonly _onResultDownloaded = this.push(
    new EventEmitter<ResultDownloadedEvent>(),
  );
  readonly onResultDownloaded = this._onResultDownloaded.event;

  private readonly _onResultLoaded = this.push(
    new EventEmitter<VariantAnalysisScannedRepositoryResult>(),
  );
  readonly onResultLoaded = this._onResultLoaded.event;

  constructor(
    private readonly cliServer: CodeQLCliServer,
    private readonly logger: Logger,
  ) {
    super();
    this.cachedResults = new Map();
  }

  public async download(
    variantAnalysisId: number,
    repoTask: VariantAnalysisRepositoryTask,
    variantAnalysisStoragePath: string,
    onDownloadPercentageChanged: (downloadPercentage: number) => Promise<void>,
  ): Promise<void> {
    if (!repoTask.artifactUrl) {
      throw new Error("Missing artifact URL");
    }

    const resultDirectory = this.getRepoStorageDirectory(
      variantAnalysisStoragePath,
      repoTask.repository.fullName,
    );

    await writeRepoTask(resultDirectory, repoTask);

    const zipFilePath = join(resultDirectory, "results.zip");

    const response = await fetch(repoTask.artifactUrl);

    let responseSize = parseInt(response.headers.get("content-length") || "0");
    if (responseSize === 0 && response.size > 0) {
      responseSize = response.size;
    }

    let amountDownloaded = 0;
    for await (const chunk of response.body) {
      await appendFile(zipFilePath, Buffer.from(chunk));
      amountDownloaded += chunk.length;
      await onDownloadPercentageChanged(
        Math.floor((amountDownloaded / responseSize) * 100),
      );
    }

    const unzippedFilesDirectory = join(
      resultDirectory,
      VariantAnalysisResultsManager.RESULTS_DIRECTORY,
    );

    await unzipFile(zipFilePath, unzippedFilesDirectory);

    this._onResultDownloaded.fire({
      variantAnalysisId,
      repoTask,
    });
  }

  public async loadResults(
    variantAnalysisId: number,
    variantAnalysisStoragePath: string,
    repositoryFullName: string,
    options?: LoadResultsOptions,
  ): Promise<VariantAnalysisScannedRepositoryResult> {
    const result = this.cachedResults.get(
      createCacheKey(variantAnalysisId, repositoryFullName),
    );
    if (result) {
      this._onResultLoaded.fire(result);
      return result;
    }

    if (options?.skipCacheStore) {
      return this.loadResultsFromStorage(
        variantAnalysisId,
        variantAnalysisStoragePath,
        repositoryFullName,
      );
    }

    return this.loadResultsIntoMemory(
      variantAnalysisId,
      variantAnalysisStoragePath,
      repositoryFullName,
    );
  }

  private async loadResultsIntoMemory(
    variantAnalysisId: number,
    variantAnalysisStoragePath: string,
    repositoryFullName: string,
  ): Promise<VariantAnalysisScannedRepositoryResult> {
    const result = await this.loadResultsFromStorage(
      variantAnalysisId,
      variantAnalysisStoragePath,
      repositoryFullName,
    );
    this.cachedResults.set(
      createCacheKey(variantAnalysisId, repositoryFullName),
      result,
    );
    this._onResultLoaded.fire(result);
    return result;
  }

  private async loadResultsFromStorage(
    variantAnalysisId: number,
    variantAnalysisStoragePath: string,
    repositoryFullName: string,
  ): Promise<VariantAnalysisScannedRepositoryResult> {
    if (
      !(await this.isVariantAnalysisRepoDownloaded(
        variantAnalysisStoragePath,
        repositoryFullName,
      ))
    ) {
      throw new Error("Variant analysis results not downloaded");
    }

    const storageDirectory = this.getRepoStorageDirectory(
      variantAnalysisStoragePath,
      repositoryFullName,
    );

    const repoTask: VariantAnalysisRepositoryTask = await readRepoTask(
      storageDirectory,
    );

    if (!repoTask.databaseCommitSha || !repoTask.sourceLocationPrefix) {
      throw new Error("Missing database commit SHA");
    }

    const fileLinkPrefix = this.createGitHubDotcomFileLinkPrefix(
      repoTask.repository.fullName,
      repoTask.databaseCommitSha,
    );

    const resultsDirectory = join(
      storageDirectory,
      VariantAnalysisResultsManager.RESULTS_DIRECTORY,
    );
    const sarifPath = join(resultsDirectory, "results.sarif");
    const bqrsPath = join(resultsDirectory, "results.bqrs");
    if (await pathExists(sarifPath)) {
      const interpretedResults = await this.readSarifResults(
        sarifPath,
        fileLinkPrefix,
      );

      return {
        variantAnalysisId,
        repositoryId: repoTask.repository.id,
        interpretedResults,
      };
    }

    if (await pathExists(bqrsPath)) {
      const rawResults = await this.readBqrsResults(
        bqrsPath,
        fileLinkPrefix,
        repoTask.sourceLocationPrefix,
      );

      return {
        variantAnalysisId,
        repositoryId: repoTask.repository.id,
        rawResults,
      };
    }

    throw new Error("Missing results file");
  }

  public async isVariantAnalysisRepoDownloaded(
    variantAnalysisStoragePath: string,
    repositoryFullName: string,
  ): Promise<boolean> {
    return await pathExists(
      this.getRepoStorageDirectory(
        variantAnalysisStoragePath,
        repositoryFullName,
      ),
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

  public getRepoStorageDirectory(
    variantAnalysisStoragePath: string,
    fullName: string,
  ): string {
    return join(variantAnalysisStoragePath, fullName);
  }

  private createGitHubDotcomFileLinkPrefix(
    fullName: string,
    sha: string,
  ): string {
    return `https://github.com/${fullName}/blob/${sha}`;
  }

  public removeAnalysisResults(variantAnalysis: VariantAnalysis) {
    const scannedRepos = variantAnalysis.scannedRepos;

    if (scannedRepos) {
      scannedRepos.forEach((scannedRepo) => {
        const cacheKey = createCacheKey(
          variantAnalysis.id,
          scannedRepo.repository.fullName,
        );
        if (this.cachedResults.get(cacheKey)) {
          this.cachedResults.delete(cacheKey);
        }
      });
    }
  }

  public dispose(disposeHandler?: DisposeHandler) {
    super.dispose(disposeHandler);

    this.cachedResults.clear();
  }
}
