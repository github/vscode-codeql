import { appendFile, pathExists, rm } from "fs-extra";
import { EOL } from "os";
import { join } from "path";

import type { Logger } from "../common/logging";
import type {
  AnalysisAlert,
  AnalysisRawResults,
} from "./shared/analysis-result";
import { sarifParser } from "../common/sarif-parser";
import { extractAnalysisAlerts } from "./sarif-processing";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import { extractRawResults } from "./bqrs-processing";
import { VariantAnalysisRepoStatus } from "./shared/variant-analysis";
import type {
  VariantAnalysis,
  VariantAnalysisRepositoryTask,
  VariantAnalysisScannedRepositoryResult,
} from "./shared/variant-analysis";
import type { DisposeHandler } from "../common/disposable-object";
import { DisposableObject } from "../common/disposable-object";
import { EventEmitter } from "vscode";
import { unzipToDirectoryConcurrently } from "../common/unzip-concurrently";
import { readRepoTask, writeRepoTask } from "./repo-tasks-store";
import type { VariantAnalysisConfig } from "../config";

type CacheKey = `${number}/${string}`;

const createCacheKey = (
  variantAnalysisId: number,
  repositoryFullName: string,
): CacheKey => `${variantAnalysisId}/${repositoryFullName}`;

type ResultDownloadedEvent = {
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
    private readonly config: VariantAnalysisConfig,
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

    // in case of restarted download delete possible artifact from previous download
    await rm(zipFilePath, { force: true });

    const response = await fetch(repoTask.artifactUrl);

    const responseSize = parseInt(
      response.headers.get("content-length") || "1",
    );

    if (!response.body) {
      throw new Error("No response body found");
    }

    const reader = response.body.getReader();

    let amountDownloaded = 0;
    for (;;) {
      const { value: chunk, done } = await reader.read();
      if (done) {
        break;
      }

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

    await unzipToDirectoryConcurrently(zipFilePath, unzippedFilesDirectory);

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

    const repoTask: VariantAnalysisRepositoryTask =
      await readRepoTask(storageDirectory);

    if (!repoTask.databaseCommitSha || !repoTask.sourceLocationPrefix) {
      throw new Error("Missing database commit SHA");
    }

    const fileLinkPrefix = this.createGitHubFileLinkPrefix(
      repoTask.repository.fullName,
      repoTask.databaseCommitSha,
    );

    const resultsDirectory = join(
      storageDirectory,
      VariantAnalysisResultsManager.RESULTS_DIRECTORY,
    );
    const sarifPath = join(resultsDirectory, "results.sarif");
    const bqrsPath = join(resultsDirectory, "results.bqrs");

    let interpretedResults: AnalysisAlert[] | undefined;
    let rawResults: AnalysisRawResults | undefined;

    if (await pathExists(sarifPath)) {
      interpretedResults = await this.readSarifResults(
        sarifPath,
        fileLinkPrefix,
      );
    }

    if (await pathExists(bqrsPath)) {
      rawResults = await this.readBqrsResults(
        bqrsPath,
        fileLinkPrefix,
        repoTask.sourceLocationPrefix,
      );
    }

    if (!interpretedResults && !rawResults) {
      throw new Error("Missing results file");
    }

    return {
      variantAnalysisId,
      repositoryId: repoTask.repository.id,
      interpretedResults,
      rawResults,
    };
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

  private createGitHubFileLinkPrefix(fullName: string, sha: string): string {
    return new URL(
      `/${fullName}/blob/${sha}`,
      this.config.githubUrl,
    ).toString();
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

  public getLoadedResultsForVariantAnalysis(
    variantAnalysis: VariantAnalysis,
  ): VariantAnalysisScannedRepositoryResult[] {
    const scannedRepos = variantAnalysis.scannedRepos?.filter(
      (r) => r.analysisStatus === VariantAnalysisRepoStatus.Succeeded,
    );

    if (!scannedRepos) {
      return [];
    }

    return scannedRepos
      .map((scannedRepo) =>
        this.cachedResults.get(
          createCacheKey(variantAnalysis.id, scannedRepo.repository.fullName),
        ),
      )
      .filter(
        (r): r is VariantAnalysisScannedRepositoryResult => r !== undefined,
      );
  }

  public dispose(disposeHandler?: DisposeHandler) {
    super.dispose(disposeHandler);

    this.cachedResults.clear();
  }
}
