import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

import { Credentials } from '../authentication';
import { Logger } from '../logging';
import { AnalysisAlert, AnalysisRawResults } from './shared/analysis-result';
import { sarifParser } from '../sarif-parser';
import { extractAnalysisAlerts } from './sarif-processing';
import { CodeQLCliServer } from '../cli';
import { extractRawResults } from './bqrs-processing';
import { VariantAnalysis, VariantAnalysisScannedRepositoryResult } from './shared/variant-analysis';
import { DisposableObject, DisposeHandler } from '../pure/disposable-object';
import { VariantAnalysisRepoTask } from './gh-api/variant-analysis';
import * as ghApiClient from './gh-api/gh-api-client';
import { EventEmitter } from 'vscode';
import { unzipFile } from '../pure/zip';

type CacheKey = `${number}/${string}`;

const createCacheKey = (variantAnalysisId: number, repositoryFullName: string): CacheKey => `${variantAnalysisId}/${repositoryFullName}`;

export type ResultDownloadedEvent = {
  variantAnalysisId: number;
  repoTask: VariantAnalysisRepoTask;
}

export class VariantAnalysisResultsManager extends DisposableObject {
  private static readonly REPO_TASK_FILENAME = 'repo_task.json';
  private static readonly RESULTS_DIRECTORY = 'results';

  public readonly cachedResults: Map<CacheKey, VariantAnalysisScannedRepositoryResult>;

  private readonly _onResultDownloaded = this.push(new EventEmitter<ResultDownloadedEvent>());
  readonly onResultDownloaded = this._onResultDownloaded.event;

  private readonly _onResultLoaded = this.push(new EventEmitter<VariantAnalysisScannedRepositoryResult>());
  readonly onResultLoaded = this._onResultLoaded.event;

  constructor(
    private readonly cliServer: CodeQLCliServer,
    private readonly logger: Logger,
  ) {
    super();
    this.cachedResults = new Map();
  }

  public async download(
    credentials: Credentials,
    variantAnalysisId: number,
    repoTask: VariantAnalysisRepoTask,
    variantAnalysisStoragePath: string,
  ): Promise<void> {
    if (!repoTask.artifact_url) {
      throw new Error('Missing artifact URL');
    }

    const resultDirectory = this.getRepoStorageDirectory(variantAnalysisStoragePath, repoTask.repository.full_name);

    const result = await ghApiClient.getVariantAnalysisRepoResult(
      credentials,
      repoTask.artifact_url
    );

    if (!(await fs.pathExists(resultDirectory))) {
      await fs.mkdir(resultDirectory, { recursive: true });
    }

    await fs.outputJson(path.join(resultDirectory, VariantAnalysisResultsManager.REPO_TASK_FILENAME), repoTask);

    const zipFilePath = path.join(resultDirectory, 'results.zip');
    const unzippedFilesDirectory = path.join(resultDirectory, VariantAnalysisResultsManager.RESULTS_DIRECTORY);

    fs.writeFileSync(zipFilePath, Buffer.from(result));
    await unzipFile(zipFilePath, unzippedFilesDirectory);

    this._onResultDownloaded.fire({
      variantAnalysisId,
      repoTask,
    });
  }

  public async loadResults(
    variantAnalysisId: number,
    variantAnalysisStoragePath: string,
    repositoryFullName: string
  ): Promise<VariantAnalysisScannedRepositoryResult> {
    const result = this.cachedResults.get(createCacheKey(variantAnalysisId, repositoryFullName));

    return result ?? await this.loadResultsIntoMemory(variantAnalysisId, variantAnalysisStoragePath, repositoryFullName);
  }

  public async loadResultsIntoMemory(
    variantAnalysisId: number,
    variantAnalysisStoragePath: string,
    repositoryFullName: string,
  ): Promise<VariantAnalysisScannedRepositoryResult> {
    const result = await this.loadResultsFromStorage(variantAnalysisId, variantAnalysisStoragePath, repositoryFullName);
    this.cachedResults.set(createCacheKey(variantAnalysisId, repositoryFullName), result);
    this._onResultLoaded.fire(result);
    return result;
  }

  public async loadResultsFromStorage(
    variantAnalysisId: number,
    variantAnalysisStoragePath: string,
    repositoryFullName: string,
  ): Promise<VariantAnalysisScannedRepositoryResult> {
    if (!(await this.isVariantAnalysisRepoDownloaded(variantAnalysisStoragePath, repositoryFullName))) {
      throw new Error('Variant analysis results not downloaded');
    }

    const storageDirectory = this.getRepoStorageDirectory(variantAnalysisStoragePath, repositoryFullName);

    const repoTask: VariantAnalysisRepoTask = await fs.readJson(path.join(storageDirectory, VariantAnalysisResultsManager.REPO_TASK_FILENAME));

    if (!repoTask.database_commit_sha || !repoTask.source_location_prefix) {
      throw new Error('Missing database commit SHA');
    }

    const fileLinkPrefix = this.createGitHubDotcomFileLinkPrefix(repoTask.repository.full_name, repoTask.database_commit_sha);

    const resultsDirectory = path.join(storageDirectory, VariantAnalysisResultsManager.RESULTS_DIRECTORY);
    const sarifPath = path.join(resultsDirectory, 'results.sarif');
    const bqrsPath = path.join(resultsDirectory, 'results.bqrs');
    if (await fs.pathExists(sarifPath)) {
      const interpretedResults = await this.readSarifResults(sarifPath, fileLinkPrefix);

      return {
        variantAnalysisId,
        repositoryId: repoTask.repository.id,
        interpretedResults,
      };
    }

    if (await fs.pathExists(bqrsPath)) {
      const rawResults = await this.readBqrsResults(bqrsPath, fileLinkPrefix, repoTask.source_location_prefix);

      return {
        variantAnalysisId,
        repositoryId: repoTask.repository.id,
        rawResults,
      };
    }

    throw new Error('Missing results file');
  }

  private async isVariantAnalysisRepoDownloaded(
    variantAnalysisStoragePath: string,
    repositoryFullName: string,
  ): Promise<boolean> {
    return await fs.pathExists(this.getRepoStorageDirectory(variantAnalysisStoragePath, repositoryFullName));
  }

  private async readBqrsResults(filePath: string, fileLinkPrefix: string, sourceLocationPrefix: string): Promise<AnalysisRawResults> {
    return await extractRawResults(this.cliServer, this.logger, filePath, fileLinkPrefix, sourceLocationPrefix);
  }

  private async readSarifResults(filePath: string, fileLinkPrefix: string): Promise<AnalysisAlert[]> {
    const sarifLog = await sarifParser(filePath);

    const processedSarif = extractAnalysisAlerts(sarifLog, fileLinkPrefix);
    if (processedSarif.errors.length) {
      void this.logger.log(`Error processing SARIF file: ${os.EOL}${processedSarif.errors.join(os.EOL)}`);
    }

    return processedSarif.alerts;
  }

  public getRepoStorageDirectory(variantAnalysisStoragePath: string, fullName: string): string {
    return path.join(
      variantAnalysisStoragePath,
      fullName
    );
  }

  private createGitHubDotcomFileLinkPrefix(fullName: string, sha: string): string {
    return `https://github.com/${fullName}/blob/${sha}`;
  }

  public removeAnalysesResults(variantAnalysis: VariantAnalysis) {
    const scannedRepos = variantAnalysis.scannedRepos;

    if (scannedRepos) {
      scannedRepos.forEach(scannedRepo => {
        const cacheKey = createCacheKey(variantAnalysis.id, scannedRepo.repository.fullName);
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
