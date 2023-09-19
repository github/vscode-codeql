import TelemetryReporter from "vscode-extension-telemetry";
import {
  ExtensionContext,
  workspace,
  ConfigurationTarget,
  window,
} from "vscode";
import {
  ExtensionTelemetryListener,
  telemetryListener as globalTelemetryListener,
} from "../../../src/common/vscode/telemetry";
import { UserCancellationException } from "../../../src/common/vscode/progress";
import { ENABLE_TELEMETRY } from "../../../src/config";
import { createMockExtensionContext } from "./index";
import { vscodeGetConfigurationMock } from "../test-config";
import { redactableError } from "../../../src/common/errors";
import { SemVer } from "semver";

// setting preferences can trigger lots of background activity
// so need to bump up the timeout of this test.
jest.setTimeout(10000);

describe("telemetry reporting", () => {
  let originalTelemetryExtension: boolean | undefined;
  let originalTelemetryGlobal: boolean | undefined;
  let isCanary: string;
  let ctx: ExtensionContext;
  let telemetryListener: ExtensionTelemetryListener;

  let sendTelemetryEventSpy: jest.SpiedFunction<
    typeof TelemetryReporter.prototype.sendTelemetryEvent
  >;
  let sendTelemetryErrorEventSpy: jest.SpiedFunction<
    typeof TelemetryReporter.prototype.sendTelemetryErrorEvent
  >;
  let disposeSpy: jest.SpiedFunction<
    typeof TelemetryReporter.prototype.dispose
  >;

  let showInformationMessageSpy: jest.SpiedFunction<
    typeof window.showInformationMessage
  >;

  beforeEach(async () => {
    vscodeGetConfigurationMock.mockRestore();

    try {
      // in case a previous test has accidentally activated this extension,
      // need to disable it first.
      // Accidentaly activation may happen asynchronously due to activationEvents
      // specified in the package.json.
      globalTelemetryListener?.dispose();

      ctx = createMockExtensionContext();

      sendTelemetryEventSpy = jest
        .spyOn(TelemetryReporter.prototype, "sendTelemetryEvent")
        .mockReturnValue(undefined);
      sendTelemetryErrorEventSpy = jest
        .spyOn(TelemetryReporter.prototype, "sendTelemetryErrorEvent")
        .mockReturnValue(undefined);
      disposeSpy = jest
        .spyOn(TelemetryReporter.prototype, "dispose")
        .mockResolvedValue(undefined);

      showInformationMessageSpy = jest
        .spyOn(window, "showInformationMessage")
        .mockResolvedValue(undefined);

      originalTelemetryExtension = workspace
        .getConfiguration()
        .get<boolean>("codeQL.telemetry.enableTelemetry");
      originalTelemetryGlobal = workspace
        .getConfiguration()
        .get<boolean>("telemetry.enableTelemetry");
      isCanary = (!!workspace
        .getConfiguration()
        .get<boolean>("codeQL.canary")).toString();

      // each test will default to telemetry being enabled
      await enableTelemetry("telemetry", true);
      await enableTelemetry("codeQL.telemetry", true);

      telemetryListener = new ExtensionTelemetryListener(
        "my-id",
        "1.2.3",
        "fake-key",
        ctx,
      );
      await wait(100);
    } catch (e) {
      console.error(e);
    }
  });

  afterEach(async () => {
    telemetryListener?.dispose();
    // await wait(100);
    try {
      await enableTelemetry("telemetry", originalTelemetryGlobal);
      await enableTelemetry("codeQL.telemetry", originalTelemetryExtension);
    } catch (e) {
      console.error(e);
    }
  });

  it("should initialize telemetry when both options are enabled", async () => {
    await telemetryListener.initialize();

    expect(telemetryListener._reporter).toBeDefined();

    const reporter: any = telemetryListener._reporter;
    expect(reporter.extensionId).toBe("my-id");
    expect(reporter.extensionVersion).toBe("1.2.3");
    expect(reporter.userOptIn).toBe(true); // enabled
  });

  it("should initialize telemetry when global option disabled", async () => {
    await enableTelemetry("telemetry", false);
    await telemetryListener.initialize();
    expect(telemetryListener._reporter).toBeDefined();

    const reporter: any = telemetryListener._reporter;
    expect(reporter.userOptIn).toBe(false); // disabled
  });

  it("should not initialize telemetry when extension option disabled", async () => {
    await enableTelemetry("codeQL.telemetry", false);
    await telemetryListener.initialize();

    expect(telemetryListener._reporter).toBeUndefined();
  });

  it("should not initialize telemetry when both options disabled", async () => {
    await enableTelemetry("codeQL.telemetry", false);
    await enableTelemetry("telemetry", false);
    await telemetryListener.initialize();
    expect(telemetryListener._reporter).toBeUndefined();
  });

  it("should dispose telemetry object when re-initializing and should not add multiple", async () => {
    await telemetryListener.initialize();
    expect(telemetryListener._reporter).toBeDefined();
    const firstReporter = telemetryListener._reporter;
    await telemetryListener.initialize();
    expect(telemetryListener._reporter).toBeDefined();
    expect(telemetryListener._reporter).not.toBe(firstReporter);

    expect(disposeSpy).toBeCalledTimes(1);

    // initializing a third time continues to dispose
    await telemetryListener.initialize();
    expect(disposeSpy).toBeCalledTimes(2);
  });

  it("should reinitialize reporter when extension setting changes", async () => {
    await telemetryListener.initialize();

    expect(disposeSpy).not.toBeCalled();
    expect(telemetryListener._reporter).toBeDefined();

    // this disables the reporter
    await enableTelemetry("codeQL.telemetry", false);

    expect(telemetryListener._reporter).toBeUndefined();

    expect(disposeSpy).toBeCalledTimes(1);

    // creates a new reporter, but does not dispose again
    await enableTelemetry("codeQL.telemetry", true);

    expect(telemetryListener._reporter).toBeDefined();
    expect(disposeSpy).toBeCalledTimes(1);
  });

  it("should set userOprIn to false when global setting changes", async () => {
    await telemetryListener.initialize();

    const reporter: any = telemetryListener._reporter;
    expect(reporter.userOptIn).toBe(true); // enabled

    await enableTelemetry("telemetry", false);
    expect(reporter.userOptIn).toBe(false); // disabled
  });

  it("should send an event", async () => {
    await telemetryListener.initialize();

    telemetryListener.sendCommandUsage("command-id", 1234, undefined);

    expect(sendTelemetryEventSpy).toHaveBeenCalledWith(
      "command-usage",
      {
        name: "command-id",
        status: "Success",
        isCanary,
        cliVersion: "not-set",
      },
      { executionTime: 1234 },
    );
    expect(sendTelemetryErrorEventSpy).not.toBeCalled();
  });

  it("should send a command usage event with an error", async () => {
    await telemetryListener.initialize();

    telemetryListener.sendCommandUsage(
      "command-id",
      1234,
      new UserCancellationException(),
    );

    expect(sendTelemetryEventSpy).toHaveBeenCalledWith(
      "command-usage",
      {
        name: "command-id",
        status: "Cancelled",
        isCanary,
        cliVersion: "not-set",
      },
      { executionTime: 1234 },
    );
    expect(sendTelemetryErrorEventSpy).not.toBeCalled();
  });

  it("should send a command usage event with a cli version", async () => {
    await telemetryListener.initialize();
    telemetryListener.cliVersion = new SemVer("1.2.3");

    telemetryListener.sendCommandUsage(
      "command-id",
      1234,
      new UserCancellationException(),
    );

    expect(sendTelemetryEventSpy).toHaveBeenCalledWith(
      "command-usage",
      {
        name: "command-id",
        status: "Cancelled",
        isCanary,
        cliVersion: "1.2.3",
      },
      { executionTime: 1234 },
    );
    expect(sendTelemetryErrorEventSpy).not.toBeCalled();

    // Verify that if the cli version is not set, then the telemetry falls back to "not-set"
    sendTelemetryEventSpy.mockClear();
    telemetryListener.cliVersion = undefined;

    telemetryListener.sendCommandUsage(
      "command-id",
      5678,
      new UserCancellationException(),
    );

    expect(sendTelemetryEventSpy).toHaveBeenCalledWith(
      "command-usage",
      {
        name: "command-id",
        status: "Cancelled",
        isCanary,
        cliVersion: "not-set",
      },
      { executionTime: 5678 },
    );
    expect(sendTelemetryErrorEventSpy).not.toBeCalled();
  });

  it("should avoid sending an event when telemetry is disabled", async () => {
    await telemetryListener.initialize();
    await enableTelemetry("codeQL.telemetry", false);

    telemetryListener.sendCommandUsage("command-id", 1234, undefined);
    telemetryListener.sendCommandUsage("command-id", 1234, new Error());

    expect(sendTelemetryEventSpy).not.toBeCalled();
    expect(sendTelemetryErrorEventSpy).not.toBeCalled();
  });

  it("should send an event when telemetry is re-enabled", async () => {
    await telemetryListener.initialize();
    await enableTelemetry("codeQL.telemetry", false);
    await enableTelemetry("codeQL.telemetry", true);

    telemetryListener.sendCommandUsage("command-id", 1234, undefined);

    expect(sendTelemetryEventSpy).toHaveBeenCalledWith(
      "command-usage",
      {
        name: "command-id",
        status: "Success",
        isCanary,
        cliVersion: "not-set",
      },
      { executionTime: 1234 },
    );
    expect(sendTelemetryErrorEventSpy).not.toBeCalled();
  });

  it("should filter undesired properties from telemetry payload", async () => {
    await telemetryListener.initialize();
    // Reach into the internal appInsights client to grab our telemetry processor.
    const telemetryProcessor: Function = (telemetryListener._reporter as any)
      .appInsightsClient._telemetryProcessors[0];
    const envelop = {
      tags: {
        "ai.cloud.roleInstance": true,
        other: true,
      },
      data: {
        baseData: {
          properties: {
            "common.remotename": true,
            other: true,
          },
        },
      },
    };
    const res = telemetryProcessor(envelop);
    expect(res).toBe(true);
    expect(envelop).toEqual({
      tags: {
        other: true,
      },
      data: {
        baseData: {
          properties: {
            other: true,
          },
        },
      },
    });
  });

  const resolveArg =
    (index: number) =>
    (...args: any[]) =>
      Promise.resolve(args[index]);

  it("should request permission if popup has never been seen before", async () => {
    showInformationMessageSpy.mockImplementation(
      resolveArg(3 /* "yes" item */),
    );
    await ctx.globalState.update("telemetry-request-viewed", false);
    await enableTelemetry("codeQL.telemetry", false);

    await telemetryListener.initialize();

    // Wait for user's selection to propagate in settings.
    await wait(500);

    // Dialog opened, user clicks "yes" and telemetry enabled
    expect(showInformationMessageSpy).toBeCalledTimes(1);
    expect(ENABLE_TELEMETRY.getValue()).toBe(true);
    expect(ctx.globalState.get("telemetry-request-viewed")).toBe(true);
  });

  it("should prevent telemetry if permission is denied", async () => {
    showInformationMessageSpy.mockImplementation(resolveArg(4 /* "no" item */));
    await ctx.globalState.update("telemetry-request-viewed", false);
    await enableTelemetry("codeQL.telemetry", true);

    await telemetryListener.initialize();

    // Dialog opened, user clicks "no" and telemetry disabled
    expect(showInformationMessageSpy).toBeCalledTimes(1);
    expect(ENABLE_TELEMETRY.getValue()).toBe(false);
    expect(ctx.globalState.get("telemetry-request-viewed")).toBe(true);
  });

  it("should unchange telemetry if permission dialog is dismissed", async () => {
    showInformationMessageSpy.mockResolvedValue(undefined /* cancelled */);
    await ctx.globalState.update("telemetry-request-viewed", false);

    // this causes requestTelemetryPermission to be called
    await enableTelemetry("codeQL.telemetry", false);

    // Dialog opened, and user closes without interacting with it
    expect(showInformationMessageSpy).toBeCalledTimes(1);
    expect(ENABLE_TELEMETRY.getValue()).toBe(false);
    // dialog was canceled, so should not have marked as viewed
    expect(ctx.globalState.get("telemetry-request-viewed")).toBe(false);
  });

  it("should unchange telemetry if permission dialog is cancelled if starting as true", async () => {
    await enableTelemetry("codeQL.telemetry", false);

    // as before, except start with telemetry enabled. It should _stay_ enabled if the
    // dialog is canceled.
    showInformationMessageSpy.mockResolvedValue(undefined /* cancelled */);
    await ctx.globalState.update("telemetry-request-viewed", false);

    // this causes requestTelemetryPermission to be called
    await enableTelemetry("codeQL.telemetry", true);

    // Dialog opened, and user closes without interacting with it
    // Telemetry state should not have changed
    expect(showInformationMessageSpy).toBeCalledTimes(1);
    expect(ENABLE_TELEMETRY.getValue()).toBe(true);
    // dialog was canceled, so should not have marked as viewed
    expect(ctx.globalState.get("telemetry-request-viewed")).toBe(false);
  });

  it("should avoid showing dialog if global telemetry is disabled", async () => {
    // when telemetry is disabled globally, we never want to show the
    // opt in/out dialog. We just assume that codeql telemetry should
    // remain disabled as well.
    // If the user ever turns global telemetry back on, then we can
    // show the dialog.

    await enableTelemetry("telemetry", false);
    await ctx.globalState.update("telemetry-request-viewed", false);

    await telemetryListener.initialize();

    // popup should not be shown even though we have initialized telemetry
    expect(showInformationMessageSpy).not.toBeCalled();
  });

  // This test is failing because codeQL.canary is not a registered configuration.
  // We do not want to have it registered because we don't want this item
  // appearing in the settings page. It needs to olny be set by users we tell
  // about it to.
  // At this point, I see no other way of testing re-requesting permission.
  xit("should request permission again when user changes canary setting", async () => {
    // initially, both canary and telemetry are false
    await workspace.getConfiguration().update("codeQL.canary", false);
    await enableTelemetry("codeQL.telemetry", false);
    await ctx.globalState.update("telemetry-request-viewed", true);
    await telemetryListener.initialize();
    showInformationMessageSpy.mockResolvedValue(undefined /* cancelled */);

    // set canary to true
    await workspace.getConfiguration().update("codeQL.canary", true);

    // now, we should have to click through the telemetry requestor again
    expect(ctx.globalState.get("telemetry-request-viewed")).toBe(false);
    expect(showInformationMessageSpy).toBeCalledTimes(1);
  });

  it("should send a ui-interaction telementry event", async () => {
    await telemetryListener.initialize();

    telemetryListener.sendUIInteraction("test");

    expect(sendTelemetryEventSpy).toHaveBeenCalledWith(
      "ui-interaction",
      {
        name: "test",
        isCanary,
        cliVersion: "not-set",
      },
      {},
    );
    expect(sendTelemetryErrorEventSpy).not.toBeCalled();
  });

  it("should send a ui-interaction telementry event with a cli version", async () => {
    await telemetryListener.initialize();

    telemetryListener.cliVersion = new SemVer("1.2.3");
    telemetryListener.sendUIInteraction("test");

    expect(sendTelemetryEventSpy).toHaveBeenCalledWith(
      "ui-interaction",
      {
        name: "test",
        isCanary,
        cliVersion: "1.2.3",
      },
      {},
    );
    expect(sendTelemetryErrorEventSpy).not.toBeCalled();
  });

  it("should send an error telementry event", async () => {
    await telemetryListener.initialize();

    telemetryListener.sendError(redactableError`test`);

    expect(sendTelemetryEventSpy).not.toBeCalled();
    expect(sendTelemetryErrorEventSpy).toHaveBeenCalledWith(
      "error",
      {
        message: "test",
        isCanary,
        stack: expect.any(String),
        cliVersion: "not-set",
      },
      {},
    );
  });

  it("should send an error telementry event with a cli version", async () => {
    await telemetryListener.initialize();
    telemetryListener.cliVersion = new SemVer("1.2.3");

    telemetryListener.sendError(redactableError`test`);

    expect(sendTelemetryEventSpy).not.toBeCalled();
    expect(sendTelemetryErrorEventSpy).toHaveBeenCalledWith(
      "error",
      {
        message: "test",
        isCanary,
        stack: expect.any(String),
        cliVersion: "1.2.3",
      },
      {},
    );
  });

  it("should redact error message contents", async () => {
    await telemetryListener.initialize();

    telemetryListener.sendError(
      redactableError`test message with secret information: ${42} and more ${"secret"} parts`,
    );

    expect(sendTelemetryEventSpy).not.toBeCalled();
    expect(sendTelemetryErrorEventSpy).toHaveBeenCalledWith(
      "error",
      {
        message:
          "test message with secret information: [REDACTED] and more [REDACTED] parts",
        isCanary,
        cliVersion: "not-set",
        stack: expect.any(String),
      },
      {},
    );
  });

  async function enableTelemetry(section: string, value: boolean | undefined) {
    await workspace
      .getConfiguration(section)
      .update("enableTelemetry", value, ConfigurationTarget.Global);

    // Need to wait some time since the onDidChangeConfiguration listeners fire
    // asynchronously. Must ensure they to complete in order to have a successful test.
    await wait(100);
  }

  async function wait(ms = 0) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
});
