import * as vscode from 'vscode';
import { Credentials } from '../authentication';
import { Logger } from '../logging';
import { showAndLogErrorMessage } from '../helpers';
import { RemoteQuery } from './remote-query';
import { RemoteQueryWorkflowResult } from './remote-query-workflow-result';

export class RemoteQueriesMonitor {
  private static readonly twoDaysInSeconds = 86400;

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
      await showAndLogErrorMessage('Error authenticating with GitHub');
    }

    let attemptCount = 0;

    const octokit = await credentials.getOctokit();

    while (attemptCount <= RemoteQueriesMonitor.twoDaysInSeconds) {
      if (cancellationToken && cancellationToken.isCancellationRequested) {
        return { status: 'Cancelled' };
      }

      const workflowRun = await octokit.rest.actions.getWorkflowRun({
        owner: remoteQuery.controllerRepository.owner,
        repo: remoteQuery.controllerRepository.name,
        run_id: remoteQuery.actionsWorkflowRunId
      });

      if (this.areStringsSame(workflowRun.data.status, 'completed')) {
        if (this.areStringsSame(workflowRun.data.conclusion, 'success')) {
          return { status: 'CompletedSuccessfully' };
        } else {
          const error = this.getWorkflowError(workflowRun.data.conclusion);
          return { status: 'CompletedUnsuccessfully', error };
        }
      }

      await this.sleep(1000);
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

    if (this.areStringsSame(conclusion, 'cancelled')) {
      return 'The remote query execution was cancelled.';
    }

    if (this.areStringsSame(conclusion, 'timed_out')) {
      return 'The remote query execution timed out.';
    }

    if (this.areStringsSame(conclusion, 'failure')) {
      // TODO: Get the actual error from the workflow.
      return 'The remote query execution has failed.';
    }

    return `Unexpected query execution conclusion: ${conclusion}`;
  }

  private areStringsSame(a: string | null | undefined, b: string | null | undefined): boolean {
    if ((a === undefined || a === null) && (b === undefined || b === null)) {
      return true;
    }

    if (a === undefined || a == null || b === undefined || b == null) {
      return false;
    }

    return a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0;
  }
}


