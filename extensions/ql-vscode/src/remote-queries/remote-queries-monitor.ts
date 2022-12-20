import * as vscode from "vscode";
import { Credentials } from "../authentication";
import { Logger } from "../common";
import { sleep } from "../pure/time";
import {
  getWorkflowStatus,
  isArtifactAvailable,
  RESULT_INDEX_ARTIFACT_NAME,
} from "./gh-api/gh-actions-api-client";
import { RemoteQuery } from "./remote-query";
import { RemoteQueryWorkflowResult } from "./remote-query-workflow-result";

export class RemoteQueriesMonitor {
  // With a sleep of 5 seconds, the maximum number of attempts takes
  // us to just over 2 days worth of monitoring.
  private static readonly maxAttemptCount = 17280;
  private static readonly sleepTime = 5000;

  constructor(
    private readonly extensionContext: vscode.ExtensionContext,
    private readonly logger: Logger,
  ) {}

  public async monitorQuery(
    remoteQuery: RemoteQuery,
    cancellationToken: vscode.CancellationToken,
  ): Promise<RemoteQueryWorkflowResult> {
    const credentials = await Credentials.initialize(this.extensionContext);

    let attemptCount = 0;

    while (attemptCount <= RemoteQueriesMonitor.maxAttemptCount) {
      await sleep(RemoteQueriesMonitor.sleepTime);

      if (cancellationToken && cancellationToken.isCancellationRequested) {
        return { status: "Cancelled" };
      }

      const workflowStatus = await getWorkflowStatus(
        credentials,
        remoteQuery.controllerRepository.owner,
        remoteQuery.controllerRepository.name,
        remoteQuery.actionsWorkflowRunId,
      );

      // Even if the workflow indicates it has completed, artifacts
      // might still take a while to become available. So we need to
      // check for the artifact before we can declare the workflow
      // as having completed.
      if (workflowStatus.status === "CompletedSuccessfully") {
        const resultIndexAvailable = await isArtifactAvailable(
          credentials,
          remoteQuery.controllerRepository.owner,
          remoteQuery.controllerRepository.name,
          remoteQuery.actionsWorkflowRunId,
          RESULT_INDEX_ARTIFACT_NAME,
        );

        if (resultIndexAvailable) {
          return workflowStatus;
        }

        // We don't have a result-index yet, so we'll keep monitoring.
      } else if (workflowStatus.status !== "InProgress") {
        return workflowStatus;
      }

      attemptCount++;
    }

    void this.logger.log("Variant analysis monitoring timed out after 2 days");
    return { status: "Cancelled" };
  }
}
