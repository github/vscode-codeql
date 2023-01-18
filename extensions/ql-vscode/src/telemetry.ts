import {
  ConfigurationTarget,
  Extension,
  ExtensionContext,
  ConfigurationChangeEvent,
} from "vscode";
import {
  ConfigListener,
  CANARY_FEATURES,
  ENABLE_TELEMETRY,
  GLOBAL_ENABLE_TELEMETRY,
  LOG_TELEMETRY,
  isIntegrationTestMode,
  isCanary,
} from "./config";
import { extLogger } from "./common";
import { UserCancellationException } from "./commandRunner";
import { showBinaryChoiceWithUrlDialog } from "./helpers";
import TelemetryReporter, {
  ReplacementOption,
  TelemetryEventMeasurements,
  TelemetryEventProperties,
} from "@vscode/extension-telemetry/lib/telemetryReporter";

// Key is injected at build time through the APP_INSIGHTS_KEY environment variable.
const key = "REPLACE-APP-INSIGHTS-KEY";

export enum CommandCompletion {
  Success = "Success",
  Failed = "Failed",
  Cancelled = "Cancelled",
}

// Avoid sending the following data to App insights since we don't need it.
// This will be applied to tags and baseData
const telemetryReplacementOptions: ReplacementOption[] = [
  { lookup: new RegExp("ai\\.application\\.ver") },
  { lookup: new RegExp("ai\\.device\\.id") },
  { lookup: new RegExp("ai\\.cloud\\.roleInstance") },
  { lookup: new RegExp("ai\\.cloud\\.role") },
  { lookup: new RegExp("ai\\.device\\.id") },
  { lookup: new RegExp("ai\\.device\\.osArchitecture") },
  { lookup: new RegExp("ai\\.device\\.osPlatform") },
  { lookup: new RegExp("ai\\.device\\.osVersion") },
  { lookup: new RegExp("ai\\.internal\\.sdkVersion") },
  { lookup: new RegExp("ai\\.session\\.id") },
  { lookup: new RegExp("common\\.os") },
  { lookup: new RegExp("common\\.platformversion") },
  { lookup: new RegExp("common\\.remotename") },
  { lookup: new RegExp("common\\.uikind") },
  { lookup: new RegExp("common\\.vscodesessionid") },
];

export class TelemetryListener extends ConfigListener {
  static relevantSettings = [ENABLE_TELEMETRY, CANARY_FEATURES];

  private reporter?: TelemetryReporter;

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
      e.affectsConfiguration("codeQL.telemetry.enableTelemetry") ||
      e.affectsConfiguration("telemetry.enableTelemetry")
    ) {
      await this.initialize();
    }

    // Re-request telemetry so that users can see the dialog again.
    // Re-request if codeQL.canary is being set to `true` and telemetry
    // is not currently enabled.
    if (
      e.affectsConfiguration("codeQL.canary") &&
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
      telemetryReplacementOptions,
    );
    this.push(this.reporter);
  }

  dispose() {
    super.dispose();
    void this.reporter?.dispose();
  }

  private sendTelemetryEvent(
    eventName: string,
    properties?: TelemetryEventProperties,
    measurements?: TelemetryEventMeasurements,
  ) {
    if (!this.reporter) {
      return;
    }
    this.reporter.sendTelemetryEvent(eventName, properties, measurements);
    if (LOG_TELEMETRY.getValue<boolean>()) {
      void extLogger.log(
        `Telemetry: ${JSON.stringify({ eventName, properties, measurements })}`,
      );
    }
  }

  sendCommandUsage(name: string, executionTime: number, error?: Error) {
    const status = !error
      ? CommandCompletion.Success
      : error instanceof UserCancellationException
      ? CommandCompletion.Cancelled
      : CommandCompletion.Failed;

    this.sendTelemetryEvent(
      "command-usage",
      {
        name,
        status,
        isCanary: isCanary().toString(),
      },
      { executionTime },
    );
  }

  sendUIInteraction(name: string) {
    this.sendTelemetryEvent(
      "ui-interaction",
      {
        name,
        isCanary: isCanary().toString(),
      },
      {},
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
      if (
        GLOBAL_ENABLE_TELEMETRY.getValue() &&
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
export let telemetryListener: TelemetryListener | undefined;

export async function initializeTelemetry(
  extension: Extension<any>,
  ctx: ExtensionContext,
): Promise<void> {
  if (telemetryListener !== undefined) {
    throw new Error("Telemetry is already initialized");
  }
  telemetryListener = new TelemetryListener(
    extension.id,
    extension.packageJSON.version,
    key,
    ctx,
  );
  // do not await initialization, since doing so will sometimes cause a modal popup.
  // this is a particular problem during integration tests, which will hang if a modal popup is displayed.
  void telemetryListener.initialize();
  ctx.subscriptions.push(telemetryListener);
}
