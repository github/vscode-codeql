import * as vscode from 'vscode';
import { Credentials } from '../authentication';
import { Logger } from '../logging';
import { getWorkflowStatus } from './gh-actions-api-client';
import { RemoteQuery } from './remote-query';
import { RemoteQueryWorkflowResult } from './remote-query-workflow-result';

export class RemoteQueriesMonitor {
  // With a sleep of 5 seconds, the maximum number of attempts takes
  // us to just over 2 days worth of monitoring.
  private static readonly maxAttemptCount = 17280;
  private static readonly sleepTime = 5000;

  constructor(
    private readonly extensionContext: vscode.ExtensionContext,
    private readonly logger: Logger
  ) {
  }

  public async monitorQuery(
    remoteQuery: RemoteQuery,
    cancellationToken: vscode.CancellationToken
  ): Promise<RemoteQueryWorkflowResult> {
    const credentials = await Credentials.initialize(this.extensionContext);

    if (!credentials) {
      throw Error('Error authenticating with GitHub');
    }

    let attemptCount = 0;

    while (attemptCount <= RemoteQueriesMonitor.maxAttemptCount) {
      await this.sleep(RemoteQueriesMonitor.sleepTime);

      if (cancellationToken && cancellationToken.isCancellationRequested) {
        return { status: 'Cancelled' };
      }

      const workflowStatus = await getWorkflowStatus(
        credentials,
        remoteQuery.controllerRepository.owner,
        remoteQuery.controllerRepository.name,
        remoteQuery.actionsWorkflowRunId);

      if (workflowStatus.status !== 'InProgress') {
        return workflowStatus;
      }

      attemptCount++;
    }

    void this.logger.log('Remote query monitoring timed out after 2 days');
    return { status: 'Cancelled' };
  }

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


