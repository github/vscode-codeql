import {
  ConfigurationTarget,
  Extension,
  ExtensionContext,
  ConfigurationChangeEvent,
} from "vscode";
import TelemetryReporter from "vscode-extension-telemetry";
import {
  ConfigListener,
  CANARY_FEATURES,
  ENABLE_TELEMETRY,
  GLOBAL_ENABLE_TELEMETRY,
  LOG_TELEMETRY,
  isIntegrationTestMode,
  isCanary,
  GLOBAL_TELEMETRY_LEVEL,
} from "../../config";
import * as appInsights from "applicationinsights";
import { extLogger } from "../logging/vscode";
import { UserCancellationException } from "./progress";
import { showBinaryChoiceWithUrlDialog } from "./dialog";
import { RedactableError } from "../errors";
import { SemVer } from "semver";
import { AppTelemetry } from "../telemetry";

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

export class ExtensionTelemetryListener
  extends ConfigListener
  implements AppTelemetry
{
  static relevantSettings = [ENABLE_TELEMETRY, CANARY_FEATURES];

  private reporter?: TelemetryReporter;

  private cliVersionStr = NOT_SET_CLI_VERSION;

  constructor(
    private readonly id: string,
    private readonly version: string,
    private readonly key: string,
    private readonly ctx: ExtensionContext,
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
  async handleDidChangeConfiguration(
    e: ConfigurationChangeEvent,
  ): Promise<void> {
    if (
      e.affectsConfiguration(ENABLE_TELEMETRY.qualifiedName) ||
      e.affectsConfiguration(GLOBAL_ENABLE_TELEMETRY.qualifiedName) ||
      e.affectsConfiguration(GLOBAL_TELEMETRY_LEVEL.qualifiedName)
    ) {
      await this.initialize();
    }

    // Re-request telemetry so that users can see the dialog again.
    // Re-request if codeQL.canary is being set to `true` and telemetry
    // is not currently enabled.
    if (
      e.affectsConfiguration(CANARY_FEATURES.qualifiedName) &&
      CANARY_FEATURES.getValue() &&
      !ENABLE_TELEMETRY.getValue()
    ) {
      await this.setTelemetryRequested(false);
      await this.requestTelemetryPermission();
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
      /* anonymize stack traces */ true,
    );
    this.push(this.reporter);

    const client = (this.reporter as any)
      .appInsightsClient as appInsights.TelemetryClient;
    if (client) {
      // add a telemetry processor to delete unwanted properties
      client.addTelemetryProcessor((envelope: any) => {
        tagsToRemove.forEach((tag) => delete envelope.tags[tag]);
        const baseDataProperties = (envelope.data as any)?.baseData?.properties;
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
    super.dispose();
    void this.reporter?.dispose();
  }

  sendCommandUsage(name: string, executionTime: number, error?: Error): void {
    if (!this.reporter) {
      return;
    }
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
    if (!this.reporter) {
      return;
    }

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
    if (!this.reporter) {
      return;
    }

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

  /**
   * Displays a popup asking the user if they want to enable telemetry
   * for this extension.
   */
  async requestTelemetryPermission() {
    if (!this.wasTelemetryRequested()) {
      // if global telemetry is disabled, avoid showing the dialog or making any changes
      let result = undefined;
      if (
        isGlobalTelemetryEnabled() &&
        // Avoid showing the dialog if we are in integration test mode.
        !isIntegrationTestMode()
      ) {
        // Extension won't start until this completes.
        result = await showBinaryChoiceWithUrlDialog(
          "Does the CodeQL Extension by GitHub have your permission to collect usage data and metrics to help us improve CodeQL for VSCode?",
          "https://codeql.github.com/docs/codeql-for-visual-studio-code/about-telemetry-in-codeql-for-visual-studio-code",
        );
      }
      if (result !== undefined) {
        await Promise.all([
          this.setTelemetryRequested(true),
          ENABLE_TELEMETRY.updateValue<boolean>(
            result,
            ConfigurationTarget.Global,
          ),
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

  set cliVersion(version: SemVer | undefined) {
    this.cliVersionStr = version ? version.toString() : NOT_SET_CLI_VERSION;
  }

  private disposeReporter() {
    if (this.reporter) {
      void this.reporter.dispose();
      this.reporter = undefined;
    }
  }

  private wasTelemetryRequested(): boolean {
    return !!this.ctx.globalState.get<boolean>("telemetry-request-viewed");
  }

  private async setTelemetryRequested(newValue: boolean): Promise<void> {
    await this.ctx.globalState.update("telemetry-request-viewed", newValue);
  }
}

/**
 * The global Telemetry instance
 */
export let telemetryListener: ExtensionTelemetryListener | undefined;

export async function initializeTelemetry(
  extension: Extension<any>,
  ctx: ExtensionContext,
): Promise<ExtensionTelemetryListener> {
  if (telemetryListener !== undefined) {
    throw new Error("Telemetry is already initialized");
  }
  telemetryListener = new ExtensionTelemetryListener(
    extension.id,
    extension.packageJSON.version,
    key,
    ctx,
  );
  // do not await initialization, since doing so will sometimes cause a modal popup.
  // this is a particular problem during integration tests, which will hang if a modal popup is displayed.
  void telemetryListener.initialize();
  ctx.subscriptions.push(telemetryListener);
  return telemetryListener;
}

function isGlobalTelemetryEnabled(): boolean {
  // If "enableTelemetry" is set to false, no telemetry will be sent regardless of the value of "telemetryLevel"
  const enableTelemetry: boolean | undefined =
    GLOBAL_ENABLE_TELEMETRY.getValue();
  if (enableTelemetry === false) {
    return false;
  }

  // If a value for "telemetry.telemetryLevel" is provided, then use that
  const telemetryLevel: string | undefined = GLOBAL_TELEMETRY_LEVEL.getValue();
  if (telemetryLevel !== undefined) {
    return telemetryLevel === "error" || telemetryLevel === "on";
  }

  // Otherwise fall back to the deprecated "telemetry.enableTelemetry" setting
  return !!enableTelemetry;
}
