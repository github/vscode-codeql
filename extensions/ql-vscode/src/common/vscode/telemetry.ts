import type { Extension, ExtensionContext } from "vscode";
import { ConfigurationTarget, env, Uri, window } from "vscode";
import TelemetryReporter from "vscode-extension-telemetry";
import { ENABLE_TELEMETRY, isCanary, LOG_TELEMETRY } from "../../config";
import type { TelemetryClient } from "applicationinsights";
import { extLogger } from "../logging/vscode";
import { UserCancellationException } from "./progress";
import type { RedactableError } from "../errors";
import type { SemVer } from "semver";
import type { AppTelemetry } from "../telemetry";
import type { EnvelopeTelemetry } from "applicationinsights/out/Declarations/Contracts";
import type { Disposable } from "../disposable-object";

// Key is injected at build time through the APP_INSIGHTS_KEY environment variable.
const key = "REPLACE-APP-INSIGHTS-KEY";

enum CommandCompletion {
  Success = "Success",
  Failed = "Failed",
  Cancelled = "Cancelled",
}

// Avoid sending the following data to App insights since we don't need it.
const tagsToRemove = [
  "ai.application.ver",
  "ai.device.id",
  "ai.cloud.roleInstance",
  "ai.cloud.role",
  "ai.device.id",
  "ai.device.osArchitecture",
  "ai.device.osPlatform",
  "ai.device.osVersion",
  "ai.internal.sdkVersion",
  "ai.session.id",
];

const baseDataPropertiesToRemove = [
  "common.os",
  "common.platformversion",
  "common.remotename",
  "common.uikind",
  "common.vscodesessionid",
];

const NOT_SET_CLI_VERSION = "not-set";

export class ExtensionTelemetryListener implements AppTelemetry, Disposable {
  private readonly reporter: TelemetryReporter;

  private cliVersionStr = NOT_SET_CLI_VERSION;

  constructor(id: string, version: string, key: string) {
    // We can always initialize this and send events using it because the vscode-extension-telemetry will check
    // whether the `telemetry.telemetryLevel` setting is enabled.
    this.reporter = new TelemetryReporter(
      id,
      version,
      key,
      /* anonymize stack traces */ true,
    );

    this.addTelemetryProcessor();
  }

  private addTelemetryProcessor() {
    // The appInsightsClient field is private but we want to access it anyway
    const client = this.reporter["appInsightsClient"] as TelemetryClient;
    if (client) {
      // add a telemetry processor to delete unwanted properties
      client.addTelemetryProcessor((envelope: EnvelopeTelemetry) => {
        tagsToRemove.forEach((tag) => delete envelope.tags[tag]);
        const baseDataProperties = envelope.data.baseData?.properties;
        if (baseDataProperties) {
          baseDataPropertiesToRemove.forEach(
            (prop) => delete baseDataProperties[prop],
          );
        }

        if (LOG_TELEMETRY.getValue<boolean>()) {
          void extLogger.log(`Telemetry: ${JSON.stringify(envelope)}`);
        }
        return true;
      });
    }
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
  extension: Extension<unknown>,
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

  telemetryListener = new ExtensionTelemetryListener(
    extension.id,
    extension.packageJSON.version,
    key,
  );
  ctx.subscriptions.push(telemetryListener);

  return telemetryListener;
}
