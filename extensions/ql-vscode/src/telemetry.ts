import { Disposable, ConfigurationTarget, Extension, ExtensionContext, workspace } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { CANARY_FEATURES, ENABLE_TELEMETRY, LOG_TELEMETRY } from './config';
import * as appInsights from 'applicationinsights';
import { logger } from './logging';
import { UserCancellationException } from './commandRunner';
import { showBinaryChoiceDialog } from './helpers';

// Key is injected at build time through the APP_INSIGHTS_KEY environment variable.
const key = 'REPLACE-APP-INSIGHTS-KEY';

let reporter: TelemetryReporter | undefined;
let listener: Disposable | undefined;

export enum CommandCompletion {
  Success = 'Success',
  Failed = 'Failed',
  Cancelled = 'Cancelled'
}

export async function initializeTelemetry(extension: Extension<any>, ctx: ExtensionContext): Promise<void> {
  await requestTelemetryPermission(ctx);

  registerListener(extension, ctx);
  if (reporter) {
    reporter.dispose();
    reporter = undefined;
  }
  if (ENABLE_TELEMETRY.getValue<boolean>()) {
    reporter = new TelemetryReporter(
      extension.id,
      extension.packageJSON.version,
      key,
      /* anonymize stack traces */ true
    );

    // add a telemetry processor to delete unwanted properties
    const client = (reporter as any).appInsightsClient as appInsights.TelemetryClient;
    if (client) {
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

    ctx.subscriptions.push(reporter);
  }
}

export function sendCommandUsage(name: string, executionTime: number, error?: Error) {
  if (!reporter) {
    return;
  }
  const status = !error
    ? CommandCompletion.Success
    : error instanceof UserCancellationException
      ? CommandCompletion.Cancelled
      : CommandCompletion.Failed;

  const isCanary = (!!CANARY_FEATURES.getValue<boolean>()).toString();

  reporter.sendTelemetryEvent(
    'command-usage',
    {
      name,
      status,
      isCanary
    },
    { executionTime }
  );

  // if this is a true error, also report it
  if (status === CommandCompletion.Failed && error) {
    const redactedError = {
      name: error.name,
      stack: error.stack,
      message: '<MESSAGE REDACTED>'
    };
    reporter.sendTelemetryException(
      redactedError,
      {
        type: 'command-usage',
        name,
        status,
        isCanary
      },
      { executionTime }
    );
  }
}

function registerListener(extension: Extension<any>, ctx: ExtensionContext) {
  if (!listener) {
    listener = workspace.onDidChangeConfiguration(async e => {
      if (e.affectsConfiguration('codeQL.telemetry.enableTelemetry')) {
        await initializeTelemetry(extension, ctx);
      }

      // TODO: re-request telemetry so that users can see the dialog again.
      // Re-request if codeQL.canary is being set to `true` and telemetry
      // is not currently enabled.
      if (
        e.affectsConfiguration('codeQL.canary') &&
        CANARY_FEATURES.getValue() &&
        !ENABLE_TELEMETRY.getValue()
      ) {
        await ctx.globalState.update('telemetry-request-viewed', false);
        await requestTelemetryPermission(ctx);
      }
    });
    ctx.subscriptions.push(listener);
  }
}

async function requestTelemetryPermission(ctx: ExtensionContext) {
  if (!ctx.globalState.get('telemetry-request-viewed')) {
    // if global telemetry is disabled, avoid showing the dialog or making any changes
    let result = undefined;
    if (workspace.getConfiguration().get<boolean>('telemetry.enableTelemetry')) {
      // Extension won't start until this completes. So, set a timeout here in order
      // to ensure the extension continues even if the user doesn't make a choice.
      result = await Promise.race([
        showBinaryChoiceDialog(
          'Do we have your permission to collect anonymous usage statistics help us improve CodeQL for VSCode? See [TELEMETRY.md](https://github.com/github/vscode-codeql/blob/93831e28597bb08567db9844737efd9ff188fc3a/.github/TELEMETRY.md)',
          { modal: false }
        ),
        new Promise(resolve => setTimeout(resolve, 10000))
      ]) as boolean | undefined;
    }
    if (result !== undefined) {
      await Promise.all([
        ctx.globalState.update('telemetry-request-viewed', true),
        ENABLE_TELEMETRY.updateValue<boolean>(result, ConfigurationTarget.Global),
      ]);
    }
  }
}

// Exported for testing
export function _dispose() {
  if (listener) {
    listener.dispose();
    listener = undefined;
  }
  if (reporter) {
    reporter.dispose();
    reporter = undefined;
  }
}
