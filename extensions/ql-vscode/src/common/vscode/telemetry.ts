import type { ExtensionContext } from "vscode";
import { ConfigurationTarget, env, Uri, window } from "vscode";
import TelemetryReporter from "@vscode/extension-telemetry";
import { ENABLE_TELEMETRY, isCanary } from "../../config";
import { UserCancellationException } from "./progress";
import type { RedactableError } from "../errors";
import type { SemVer } from "semver";
import type { AppTelemetry } from "../telemetry";
import type { Disposable } from "../disposable-object";

const DEFAULT_CONNECTION_STRING =
  "InstrumentationKey=ccd156f7-4e30-4c1f-9927-dc0b88e87182;IngestionEndpoint=https://eastus-1.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/;ApplicationId=beaf6f51-02b3-4426-b4b8-941aaec7a5af";

enum CommandCompletion {
  Success = "Success",
  Failed = "Failed",
  Cancelled = "Cancelled",
}

const NOT_SET_CLI_VERSION = "not-set";

export class ExtensionTelemetryListener implements AppTelemetry, Disposable {
  private readonly reporter: TelemetryReporter;

  private cliVersionStr = NOT_SET_CLI_VERSION;

  constructor(connectionString: string) {
    // We can always initialize this and send events because @vscode/extension-telemetry will check whether telemetry is enabled
    this.reporter = new TelemetryReporter(connectionString);
  }

  dispose() {
    void this.reporter.dispose();
  }

  sendCommandUsage(name: string, executionTime: number, error?: Error): void {
    const status = !error
      ? CommandCompletion.Success
      : error instanceof UserCancellationException
        ? CommandCompletion.Cancelled
        : CommandCompletion.Failed;

    this.reporter.sendTelemetryEvent(
      "command-usage",
      {
        name,
        status,
        isCanary: isCanary().toString(),
        cliVersion: this.cliVersionStr,
      },
      { executionTime },
    );
  }

  sendUIInteraction(name: string): void {
    this.reporter.sendTelemetryEvent(
      "ui-interaction",
      {
        name,
        isCanary: isCanary().toString(),
        cliVersion: this.cliVersionStr,
      },
      {},
    );
  }

  sendError(
    error: RedactableError,
    extraProperties?: { [key: string]: string },
  ): void {
    const properties: { [key: string]: string } = {
      isCanary: isCanary().toString(),
      cliVersion: this.cliVersionStr,
      message: error.redactedMessage,
      ...extraProperties,
    };
    if (error.stack && error.stack !== "") {
      properties.stack = error.stack;
    }

    this.reporter.sendTelemetryErrorEvent("error", properties, {});
  }

  sendConfigInformation(config: Record<string, string>): void {
    this.reporter.sendTelemetryEvent(
      "config",
      {
        ...config,
        isCanary: isCanary().toString(),
        cliVersion: this.cliVersionStr,
      },
      {},
    );
  }

  /**
   * Exposed for testing
   */
  get _reporter() {
    return this.reporter;
  }

  set cliVersion(version: SemVer | undefined) {
    this.cliVersionStr = version ? version.toString() : NOT_SET_CLI_VERSION;
  }
}

async function notifyTelemetryChange() {
  const continueItem = { title: "Continue", isCloseAffordance: false };
  const vsCodeTelemetryItem = {
    title: "More Information about VS Code Telemetry",
    isCloseAffordance: false,
  };
  const codeqlTelemetryItem = {
    title: "More Information about CodeQL Telemetry",
    isCloseAffordance: false,
  };
  let chosenItem;

  do {
    chosenItem = await window.showInformationMessage(
      "The CodeQL extension now follows VS Code's telemetry settings. VS Code telemetry is currently enabled. Learn how to update your telemetry settings by clicking the links below.",
      { modal: true },
      continueItem,
      vsCodeTelemetryItem,
      codeqlTelemetryItem,
    );
    if (chosenItem === vsCodeTelemetryItem) {
      await env.openExternal(
        Uri.parse(
          "https://code.visualstudio.com/docs/getstarted/telemetry",
          true,
        ),
      );
    }
    if (chosenItem === codeqlTelemetryItem) {
      await env.openExternal(
        Uri.parse(
          "https://docs.github.com/en/code-security/codeql-for-vs-code/using-the-advanced-functionality-of-the-codeql-for-vs-code-extension/telemetry-in-codeql-for-visual-studio-code",
          true,
        ),
      );
    }
  } while (chosenItem !== continueItem);
}

/**
 * The global Telemetry instance
 */
// eslint-disable-next-line import/no-mutable-exports
export let telemetryListener: ExtensionTelemetryListener | undefined;

export async function initializeTelemetry(
  ctx: ExtensionContext,
): Promise<ExtensionTelemetryListener> {
  if (telemetryListener !== undefined) {
    throw new Error("Telemetry is already initialized");
  }

  if (ENABLE_TELEMETRY.getValue<boolean | undefined>() === false) {
    if (env.isTelemetryEnabled) {
      // Await this so that the user is notified before any telemetry is sent
      await notifyTelemetryChange();
    }

    // Remove the deprecated telemetry setting
    ENABLE_TELEMETRY.updateValue(undefined, ConfigurationTarget.Global);
    ENABLE_TELEMETRY.updateValue(undefined, ConfigurationTarget.Workspace);
    ENABLE_TELEMETRY.updateValue(
      undefined,
      ConfigurationTarget.WorkspaceFolder,
    );
  }

  telemetryListener = new ExtensionTelemetryListener(DEFAULT_CONNECTION_STRING);
  ctx.subscriptions.push(telemetryListener);

  return telemetryListener;
}
