import { env, EventEmitter } from "vscode";
import { getVariantAnalysis } from "./gh-api/gh-api-client";
import { RequestError } from "@octokit/request-error";

import type {
  VariantAnalysis,
  VariantAnalysisScannedRepository,
} from "./shared/variant-analysis";
import {
  isFinalVariantAnalysisStatus,
  repoHasDownloadableArtifact,
} from "./shared/variant-analysis";
import type { VariantAnalysis as ApiVariantAnalysis } from "./gh-api/variant-analysis";
import { mapUpdatedVariantAnalysis } from "./variant-analysis-mapper";
import { DisposableObject } from "../common/disposable-object";
import { sleep } from "../common/time";
import { getErrorMessage } from "../common/helpers-pure";
import type { App } from "../common/app";
import { showAndLogWarningMessage } from "../common/logging";
import type { QueryLanguage } from "../common/query-language";

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
    private readonly getVariantAnalysis: (
      variantAnalysisId: number,
    ) => VariantAnalysis,
  ) {
    super();
  }

  public isMonitoringVariantAnalysis(variantAnalysisId: number): boolean {
    return this.monitoringVariantAnalyses.has(variantAnalysisId);
  }

  public async monitorVariantAnalysis(
    variantAnalysis: VariantAnalysis,
  ): Promise<void> {
    if (this.monitoringVariantAnalyses.has(variantAnalysis.id)) {
      void this.app.logger.log(
        `Already monitoring variant analysis ${variantAnalysis.id}`,
      );
      return;
    }

    this.monitoringVariantAnalyses.add(variantAnalysis.id);
    try {
      await this._monitorVariantAnalysis(
        variantAnalysis.id,
        variantAnalysis.controllerRepo.id,
        variantAnalysis.executionStartTime,
        variantAnalysis.query.name,
        variantAnalysis.language,
      );
    } finally {
      this.monitoringVariantAnalyses.delete(variantAnalysis.id);
    }
  }

  private async _monitorVariantAnalysis(
    variantAnalysisId: number,
    controllerRepoId: number,
    executionStartTime: number,
    queryName: string,
    language: QueryLanguage,
  ): Promise<void> {
    const variantAnalysisLabel = `${queryName} (${language}) [${new Date(
      executionStartTime,
    ).toLocaleString(env.language)}]`;

    let attemptCount = 0;
    const scannedReposDownloaded: number[] = [];

    let lastErrorShown: string | undefined = undefined;

    while (attemptCount <= VariantAnalysisMonitor.maxAttemptCount) {
      await sleep(VariantAnalysisMonitor.sleepTime);

      if (await this.shouldCancelMonitor(variantAnalysisId)) {
        return;
      }

      let variantAnalysisSummary: ApiVariantAnalysis;
      try {
        variantAnalysisSummary = await getVariantAnalysis(
          this.app.credentials,
          controllerRepoId,
          variantAnalysisId,
        );
      } catch (e) {
        const errorMessage = getErrorMessage(e);

        const message = `Error while monitoring variant analysis ${variantAnalysisLabel}: ${errorMessage}`;

        // If we have already shown this error to the user, don't show it again.
        if (lastErrorShown === errorMessage) {
          void this.app.logger.log(message);
        } else {
          void showAndLogWarningMessage(this.app.logger, message);
          lastErrorShown = errorMessage;
        }

        if (e instanceof RequestError && e.status === 404) {
          // We want to show the error message to the user, but we don't want to
          // keep polling for the variant analysis if it no longer exists.
          // Therefore, this block is down here rather than at the top of the
          // catch block.
          void this.app.logger.log(
            `Variant analysis ${variantAnalysisLabel} no longer exists or is no longer accessible, stopping monitoring.`,
          );
          // Cancel monitoring on 404, as this probably means the user does not have access to it anymore
          // e.g. lost access to repo, or repo was deleted
          return;
        }

        continue;
      }

      const variantAnalysis = mapUpdatedVariantAnalysis(
        // Get the variant analysis as known by the rest of the app, because it may
        // have been changed by the user and the monitors may not be aware of it yet.
        this.getVariantAnalysis(variantAnalysisId),
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
