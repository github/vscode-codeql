import { ConfigurationTarget, Extension, ExtensionContext, ConfigurationChangeEvent } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { ConfigListener, CANARY_FEATURES, ENABLE_TELEMETRY, GLOBAL_ENABLE_TELEMETRY, LOG_TELEMETRY } from './config';
import * as appInsights from 'applicationinsights';
import { logger } from './logging';
import { UserCancellationException } from './commandRunner';
import { showBinaryChoiceDialog } from './helpers';

// Key is injected at build time through the APP_INSIGHTS_KEY environment variable.
const key = 'REPLACE-APP-INSIGHTS-KEY';

export enum CommandCompletion {
  Success = 'Success',
  Failed = 'Failed',
  Cancelled = 'Cancelled'
}


export class TelemetryListener extends ConfigListener {

  static relevantSettings = [ENABLE_TELEMETRY, CANARY_FEATURES];

  private reporter?: TelemetryReporter;

  constructor(
    private readonly id: string,
    private readonly version: string,
    private readonly key: string,
    private readonly ctx: ExtensionContext
  ) {
    super();
  }

  /**
   * This function handles changes to relevant configuration elements. There are 2 configuration
   * ids that this function cares about:
   *
   *     * `codeQL.telemetry.enableTelemetry`: If this one has changed, then we need to re-initialize
   *        the reporter and the reporter may wind up being removed.
   *     * `codeQL.canary`: A change here could possibly re-trigger a dialog popup.
   *
   * Note that the global telemetry setting also gate-keeps whether or not to send telemetry events
   * to Application Insights. However, this gatekeeping happens inside of the vscode-extension-telemetry
   * package. So, this does not need to be handled here.
   *
   * @param e the configuration change event
   */
  async handleDidChangeConfiguration(e: ConfigurationChangeEvent): Promise<void> {
    if (e.affectsConfiguration('codeQL.telemetry.enableTelemetry')) {
      await this.initialize();
    }

    // Re-request telemetry so that users can see the dialog again.
    // Re-request if codeQL.canary is being set to `true` and telemetry
    // is not currently enabled.
    if (
      e.affectsConfiguration('codeQL.canary') &&
      CANARY_FEATURES.getValue() &&
      !ENABLE_TELEMETRY.getValue()
    ) {
      await Promise.all([
        this.setTelemetryRequested(false),
        this.requestTelemetryPermission()
      ]);
    }
  }

  async initialize() {
    await this.requestTelemetryPermission();

    this.disposeReporter();

    if (ENABLE_TELEMETRY.getValue<boolean>()) {
      this.createReporter();
    }
  }

  private createReporter() {
    this.reporter = new TelemetryReporter(
      this.id,
      this.version,
      this.key,
      /* anonymize stack traces */ true
    );
    this.push(this.reporter);

    const client = (this.reporter as any).appInsightsClient as appInsights.TelemetryClient;
    if (client) {
      // add a telemetry processor to delete unwanted properties
      client.addTelemetryProcessor((envelope) => {
        delete envelope.tags['ai.cloud.roleInstance'];
        delete (envelope.data as any)?.baseData?.properties?.['common.remotename'];

        return true;
      });

      // add a telemetry processor to log if requested
      client.addTelemetryProcessor((envelope) => {
        if (LOG_TELEMETRY.getValue<boolean>()) {
          logger.log(`Telemetry: ${JSON.stringify(envelope)}`);
        }
        return true;
      });
    }
  }

  dispose() {
    super.dispose();
    this.reporter?.dispose();
  }

  sendCommandUsage(name: string, executionTime: number, error?: Error) {
    if (!this.reporter) {
      return;
    }
    const status = !error
      ? CommandCompletion.Success
      : error instanceof UserCancellationException
        ? CommandCompletion.Cancelled
        : CommandCompletion.Failed;

    const isCanary = (!!CANARY_FEATURES.getValue<boolean>()).toString();

    this.reporter.sendTelemetryEvent(
      'command-usage',
      {
        name,
        status,
        isCanary
      },
      { executionTime }
    );
  }

  /**
   * Displays a popup asking the user if they want to enable telemetry
   * for this extension.
   */
  async requestTelemetryPermission() {
    if (!this.wasTelemetryRequested()) {
      // if global telemetry is disabled, avoid showing the dialog or making any changes
      let result = undefined;
      if (GLOBAL_ENABLE_TELEMETRY.getValue()) {
        // Extension won't start until this completes. So, set a timeout here in order
        // to ensure the extension continues even if the user doesn't make a choice.
        result = await Promise.race([
          showBinaryChoiceDialog(
            'Do we have your permission to collect anonymous usage statistics help us improve CodeQL for VSCode? See [TELEMETRY.md](https://github.com/github/vscode-codeql/blob/main/.github/TELEMETRY.md)',
            false
          ),
          new Promise(resolve => setTimeout(resolve, 10000))
        ]) as boolean | undefined;
      }
      if (result !== undefined) {
        await Promise.all([
          this.setTelemetryRequested(true),
          ENABLE_TELEMETRY.updateValue<boolean>(result, ConfigurationTarget.Global),
        ]);
      }
    }
  }

  /**
   * Exposed for testing
   */
  get _reporter() {
    return this.reporter;
  }

  private disposeReporter() {
    if (this.reporter) {
      this.reporter.dispose();
      this.reporter = undefined;
    }
  }

  private wasTelemetryRequested(): boolean {
    return !!this.ctx.globalState.get<boolean>('telemetry-request-viewed');
  }

  private async setTelemetryRequested(newValue: boolean): Promise<void> {
    await this.ctx.globalState.update('telemetry-request-viewed', newValue);
  }
}


/**
 * The global Telemetry instance
 */
export let telemetryListener: TelemetryListener;

export async function initializeTelemetry(extension: Extension<any>, ctx: ExtensionContext): Promise<void> {
  telemetryListener = new TelemetryListener(extension.id, extension.packageJSON.version, key, ctx);
  ctx.subscriptions.push(telemetryListener);
}
