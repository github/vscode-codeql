import {
  CancellationToken,
  commands,
  EventEmitter,
  ExtensionContext,
} from "vscode";
import { Credentials } from "../authentication";
import * as ghApiClient from "./gh-api/gh-api-client";

import {
  isFinalVariantAnalysisStatus,
  repoHasDownloadableArtifact,
  VariantAnalysis,
  VariantAnalysisScannedRepository,
} from "./shared/variant-analysis";
import { processUpdatedVariantAnalysis } from "./variant-analysis-processor";
import { DisposableObject } from "../pure/disposable-object";
import { sleep } from "../pure/time";

export class VariantAnalysisMonitor extends DisposableObject {
  // With a sleep of 5 seconds, the maximum number of attempts takes
  // us to just over 2 days worth of monitoring.
  public static maxAttemptCount = 17280;
  public static sleepTime = 5000;

  private readonly _onVariantAnalysisChange = this.push(
    new EventEmitter<VariantAnalysis | undefined>(),
  );
  readonly onVariantAnalysisChange = this._onVariantAnalysisChange.event;

  constructor(
    private readonly extensionContext: ExtensionContext,
    private readonly shouldCancelMonitor: (
      variantAnalysisId: number,
    ) => Promise<boolean>,
  ) {
    super();
  }

  public async monitorVariantAnalysis(
    variantAnalysis: VariantAnalysis,
    cancellationToken: CancellationToken,
  ): Promise<void> {
    const credentials = await Credentials.initialize(this.extensionContext);
    if (!credentials) {
      throw Error("Error authenticating with GitHub");
    }

    let attemptCount = 0;
    const scannedReposDownloaded: number[] = [];

    while (attemptCount <= VariantAnalysisMonitor.maxAttemptCount) {
      await sleep(VariantAnalysisMonitor.sleepTime);

      if (cancellationToken && cancellationToken.isCancellationRequested) {
        return;
      }

      if (await this.shouldCancelMonitor(variantAnalysis.id)) {
        return;
      }

      const variantAnalysisSummary = await ghApiClient.getVariantAnalysis(
        credentials,
        variantAnalysis.controllerRepo.id,
        variantAnalysis.id,
      );

      variantAnalysis = processUpdatedVariantAnalysis(
        variantAnalysis,
        variantAnalysisSummary,
      );

      this._onVariantAnalysisChange.fire(variantAnalysis);

      const downloadedRepos = this.downloadVariantAnalysisResults(
        variantAnalysis,
        scannedReposDownloaded,
      );
      scannedReposDownloaded.push(...downloadedRepos);

      if (isFinalVariantAnalysisStatus(variantAnalysis.status)) {
        break;
      }

      attemptCount++;
    }
  }

  private scheduleForDownload(
    scannedRepo: VariantAnalysisScannedRepository,
    variantAnalysisSummary: VariantAnalysis,
  ) {
    void commands.executeCommand(
      "codeQL.autoDownloadVariantAnalysisResult",
      scannedRepo,
      variantAnalysisSummary,
    );
  }

  private shouldDownload(
    scannedRepo: VariantAnalysisScannedRepository,
    alreadyDownloaded: number[],
  ): boolean {
    return (
      !alreadyDownloaded.includes(scannedRepo.repository.id) &&
      repoHasDownloadableArtifact(scannedRepo)
    );
  }

  private getReposToDownload(
    variantAnalysisSummary: VariantAnalysis,
    alreadyDownloaded: number[],
  ): VariantAnalysisScannedRepository[] {
    if (variantAnalysisSummary.scannedRepos) {
      return variantAnalysisSummary.scannedRepos.filter((scannedRepo) =>
        this.shouldDownload(scannedRepo, alreadyDownloaded),
      );
    } else {
      return [];
    }
  }

  private downloadVariantAnalysisResults(
    variantAnalysisSummary: VariantAnalysis,
    scannedReposDownloaded: number[],
  ): number[] {
    const repoResultsToDownload = this.getReposToDownload(
      variantAnalysisSummary,
      scannedReposDownloaded,
    );
    const downloadedRepos: number[] = [];

    repoResultsToDownload.forEach((scannedRepo) => {
      downloadedRepos.push(scannedRepo.repository.id);
      this.scheduleForDownload(scannedRepo, variantAnalysisSummary);
    });

    return downloadedRepos;
  }
}
