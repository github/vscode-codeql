import { Extension, ExtensionContext, workspace } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { Disposable } from 'vscode-jsonrpc';
import { ENABLE_TELEMETRY } from './config';
import { UserCancellationException } from './helpers';

const key = '6f88c20e-2879-41ed-af73-218b82e1ff44';

let reporter: TelemetryReporter | undefined;
let listener: Disposable | undefined;

export enum CommandCompletion {
  Success = 'Success',
  Failed = 'Failed',
  Cancelled = 'Cancelled'
}

export function initializeTelemetry(extension: Extension<any>, ctx: ExtensionContext): void {
  registerListener(extension, ctx);
  if (reporter) {
    reporter.dispose();
    reporter = undefined;
  }
  if (ENABLE_TELEMETRY.getValue<boolean>()) {
    reporter = new TelemetryReporter(extension.id, extension.packageJSON.version, key, /* anonymize stack traces */ true);
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

  reporter.sendTelemetryEvent(
    'command-usage',
    {
      name,
      status,
    },
    { executionTime }
  );

  // if this is a true error, also report it
  if (status === CommandCompletion.Failed) {
    reporter.sendTelemetryException(
      error!,
      {
        type: 'command-usage',
        name,
        status,
      },
      { executionTime }
    );
  }
}

function registerListener(extension: Extension<any>, ctx: ExtensionContext) {
  if (!listener) {
    listener = workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('codeQL.telemetry.enableTelemetry')) {
        initializeTelemetry(extension, ctx);
      }
    });
    ctx.subscriptions.push(listener);
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
