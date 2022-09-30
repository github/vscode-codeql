import { CancellationToken, commands, ExtensionContext } from 'vscode';
import { DisposableObject } from '../pure/disposable-object';
import { Logger } from '../logging';
import { VariantAnalysisMonitor } from './variant-analysis-monitor';

export class RemoteQueriesManager extends DisposableObject {
  private readonly variantAnalysisMonitor: VariantAnalysisMonitor;

  constructor(
    private readonly ctx: ExtensionContext,
    private readonly storagePath: string,
    logger: Logger,
  ) {
    super();
    this.variantAnalysisMonitor = new VariantAnalysisMonitor(ctx, logger);

    this.push(this.view);
  }

  public async monitorRemoteQuery(
    queryId: string,
    variant: RemoteQuery,
    cancellationToken: CancellationToken
  ): Promise<void> {
    const credentials = await Credentials.initialize(this.ctx);

    const queryWorkflowResult = await this.remoteQueriesMonitor.monitorQuery(remoteQuery, cancellationToken);
  }
}
