import * as vscode from 'vscode';
import { Credentials } from '../authentication';
import { Logger } from '../logging';
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

    const octokit = await credentials.getOctokit();

    while (attemptCount <= RemoteQueriesMonitor.maxAttemptCount) {
      if (cancellationToken && cancellationToken.isCancellationRequested) {
        return { status: 'Cancelled' };
      }

      const workflowRun = await octokit.rest.actions.getWorkflowRun({
        owner: remoteQuery.controllerRepository.owner,
        repo: remoteQuery.controllerRepository.name,
        run_id: remoteQuery.actionsWorkflowRunId
      });

      if (workflowRun.data.status === 'completed') {
        if (workflowRun.data.conclusion === 'success') {
          return { status: 'CompletedSuccessfully' };
        } else {
          const error = this.getWorkflowError(workflowRun.data.conclusion);
          return { status: 'CompletedUnsuccessfully', error };
        }
      }

      await this.sleep(RemoteQueriesMonitor.sleepTime);
      attemptCount++;
    }

    void this.logger.log('Remote query monitoring timed out after 2 days');
    return { status: 'Cancelled' };
  }

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getWorkflowError(conclusion: string | null): string {
    if (!conclusion) {
      return 'Workflow finished without a conclusion';
    }

    if (conclusion === 'cancelled') {
      return 'The remote query execution was cancelled.';
    }

    if (conclusion === 'timed_out') {
      return 'The remote query execution timed out.';
    }

    if (conclusion === 'failure') {
      // TODO: Get the actual error from the workflow.
      return 'The remote query execution has failed.';
    }

    return `Unexpected query execution conclusion: ${conclusion}`;
  }
}


