import { env, EventEmitter } from "vscode";
import { getVariantAnalysis } from "./gh-api/gh-api-client";

import {
  isFinalVariantAnalysisStatus,
  repoHasDownloadableArtifact,
  VariantAnalysis,
  VariantAnalysisScannedRepository,
} from "./shared/variant-analysis";
import { VariantAnalysis as ApiVariantAnalysis } from "./gh-api/variant-analysis";
import { processUpdatedVariantAnalysis } from "./variant-analysis-processor";
import { DisposableObject } from "../pure/disposable-object";
import { sleep } from "../pure/time";
import { getErrorMessage } from "../pure/helpers-pure";
import { showAndLogWarningMessage } from "../helpers";
import { App } from "../common/app";
import { extLogger } from "../common";

export class VariantAnalysisMonitor extends DisposableObject {
  // With a sleep of 5 seconds, the maximum number of attempts takes
  // us to just over 2 days worth of monitoring.
  public static maxAttemptCount = 17280;
  public static sleepTime = 5000;

  private readonly _onVariantAnalysisChange = this.push(
    new EventEmitter<VariantAnalysis | undefined>(),
  );
  readonly onVariantAnalysisChange = this._onVariantAnalysisChange.event;

  private readonly monitoringVariantAnalyses = new Set<number>();

  constructor(
    private readonly app: App,
    private readonly shouldCancelMonitor: (
      variantAnalysisId: number,
    ) => Promise<boolean>,
  ) {
    super();
  }

  public async monitorVariantAnalysis(
    variantAnalysis: VariantAnalysis,
  ): Promise<void> {
    if (this.monitoringVariantAnalyses.has(variantAnalysis.id)) {
      void extLogger.log(
        `Already monitoring variant analysis ${variantAnalysis.id}`,
      );
      return;
    }

    this.monitoringVariantAnalyses.add(variantAnalysis.id);
    try {
      await this._monitorVariantAnalysis(variantAnalysis);
    } finally {
      this.monitoringVariantAnalyses.delete(variantAnalysis.id);
    }
  }

  private async _monitorVariantAnalysis(
    variantAnalysis: VariantAnalysis,
  ): Promise<void> {
    let attemptCount = 0;
    const scannedReposDownloaded: number[] = [];

    let lastErrorShown: string | undefined = undefined;

    while (attemptCount <= VariantAnalysisMonitor.maxAttemptCount) {
      await sleep(VariantAnalysisMonitor.sleepTime);

      if (await this.shouldCancelMonitor(variantAnalysis.id)) {
        return;
      }

      let variantAnalysisSummary: ApiVariantAnalysis;
      try {
        variantAnalysisSummary = await getVariantAnalysis(
          this.app.credentials,
          variantAnalysis.controllerRepo.id,
          variantAnalysis.id,
        );
      } catch (e) {
        const errorMessage = getErrorMessage(e);

        const message = `Error while monitoring variant analysis ${
          variantAnalysis.query.name
        } (${variantAnalysis.query.language}) [${new Date(
          variantAnalysis.executionStartTime,
        ).toLocaleString(env.language)}]: ${errorMessage}`;

        // If we have already shown this error to the user, don't show it again.
        if (lastErrorShown === errorMessage) {
          void extLogger.log(message);
        } else {
          void showAndLogWarningMessage(message);
          lastErrorShown = errorMessage;
        }

        continue;
      }

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

      // Reset the last error shown if we have successfully retrieved the variant analysis.
      lastErrorShown = undefined;
    }
  }

  private scheduleForDownload(
    scannedRepo: VariantAnalysisScannedRepository,
    variantAnalysisSummary: VariantAnalysis,
  ) {
    void this.app.commands.execute(
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
