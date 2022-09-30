import { CancellationToken, commands, ExtensionContext } from 'vscode';
import { DisposableObject } from '../pure/disposable-object';
import { Logger } from '../logging';
import { VariantAnalysisMonitor } from './variant-analysis-monitor';
import { VariantAnalysis } from './shared/variant-analysis';

export class VariantAnalysisManager extends DisposableObject {
  private readonly variantAnalysisMonitor: VariantAnalysisMonitor;

  constructor(
    private readonly ctx: ExtensionContext,
    logger: Logger,
  ) {
    super();
    this.variantAnalysisMonitor = new VariantAnalysisMonitor(ctx, logger);
  }

  public async monitorVariantAnalysis(
    variantAnalysis: VariantAnalysis,
    cancellationToken: CancellationToken
  ): Promise<void> {
    await this.variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationToken);
  }
}
