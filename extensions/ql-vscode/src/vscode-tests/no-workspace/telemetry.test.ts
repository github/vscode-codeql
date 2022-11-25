import { expect } from "chai";
import * as sinon from "sinon";
import TelemetryReporter from "vscode-extension-telemetry";
import {
  ExtensionContext,
  workspace,
  ConfigurationTarget,
  window,
} from "vscode";
import {
  TelemetryListener,
  telemetryListener as globalTelemetryListener,
} from "../../telemetry";
import { UserCancellationException } from "../../commandRunner";
import { fail } from "assert";
import { ENABLE_TELEMETRY } from "../../config";
import { createMockExtensionContext } from "./index";

const sandbox = sinon.createSandbox();

describe("telemetry reporting", function () {
  // setting preferences can trigger lots of background activity
  // so need to bump up the timeout of this test.
  this.timeout(10000);

  let originalTelemetryExtension: boolean | undefined;
  let originalTelemetryGlobal: boolean | undefined;
  let isCanary: string;
  let ctx: ExtensionContext;
  let telemetryListener: TelemetryListener;

  beforeEach(async () => {
    try {
      // in case a previous test has accidentally activated this extension,
      // need to disable it first.
      // Accidentaly activation may happen asynchronously due to activationEvents
      // specified in the package.json.
      globalTelemetryListener?.dispose();

      ctx = createMockExtensionContext();

      sandbox.stub(TelemetryReporter.prototype, "sendTelemetryEvent");
      sandbox.stub(TelemetryReporter.prototype, "sendTelemetryException");
      sandbox.stub(TelemetryReporter.prototype, "dispose");

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

      telemetryListener = new TelemetryListener(
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
      sandbox.restore();
      await enableTelemetry("telemetry", originalTelemetryGlobal);
      await enableTelemetry("codeQL.telemetry", originalTelemetryExtension);
    } catch (e) {
      console.error(e);
    }
  });

  it("should initialize telemetry when both options are enabled", async () => {
    await telemetryListener.initialize();

    expect(telemetryListener._reporter).not.to.be.undefined;

    const reporter: any = telemetryListener._reporter;
    expect(reporter.extensionId).to.eq("my-id");
    expect(reporter.extensionVersion).to.eq("1.2.3");
    expect(reporter.userOptIn).to.eq(true); // enabled
  });

  it("should initialize telemetry when global option disabled", async () => {
    try {
      await enableTelemetry("telemetry", false);
      await telemetryListener.initialize();
      expect(telemetryListener._reporter).not.to.be.undefined;

      const reporter: any = telemetryListener._reporter;
      expect(reporter.userOptIn).to.eq(false); // disabled
    } catch (e) {
      fail(e as Error);
    }
  });

  it("should not initialize telemetry when extension option disabled", async () => {
    try {
      await enableTelemetry("codeQL.telemetry", false);
      await telemetryListener.initialize();

      expect(telemetryListener._reporter).to.be.undefined;
    } catch (e) {
      fail(e as Error);
    }
  });

  it("should not initialize telemetry when both options disabled", async () => {
    await enableTelemetry("codeQL.telemetry", false);
    await enableTelemetry("telemetry", false);
    await telemetryListener.initialize();
    expect(telemetryListener._reporter).to.be.undefined;
  });

  it("should dispose telemetry object when re-initializing and should not add multiple", async () => {
    await telemetryListener.initialize();
    expect(telemetryListener._reporter).not.to.be.undefined;
    const firstReporter = telemetryListener._reporter;
    await telemetryListener.initialize();
    expect(telemetryListener._reporter).not.to.be.undefined;
    expect(telemetryListener._reporter).not.to.eq(firstReporter);

    expect(TelemetryReporter.prototype.dispose).to.have.been.calledOnce;

    // initializing a third time continues to dispose
    await telemetryListener.initialize();
    expect(TelemetryReporter.prototype.dispose).to.have.been.calledTwice;
  });

  it("should reinitialize reporter when extension setting changes", async () => {
    await telemetryListener.initialize();

    expect(TelemetryReporter.prototype.dispose).not.to.have.been.called;
    expect(telemetryListener._reporter).not.to.be.undefined;

    // this disables the reporter
    await enableTelemetry("codeQL.telemetry", false);

    expect(telemetryListener._reporter).to.be.undefined;

    expect(TelemetryReporter.prototype.dispose).to.have.been.calledOnce;

    // creates a new reporter, but does not dispose again
    await enableTelemetry("codeQL.telemetry", true);

    expect(telemetryListener._reporter).not.to.be.undefined;
    expect(TelemetryReporter.prototype.dispose).to.have.been.calledOnce;
  });

  it("should set userOprIn to false when global setting changes", async () => {
    await telemetryListener.initialize();

    const reporter: any = telemetryListener._reporter;
    expect(reporter.userOptIn).to.eq(true); // enabled

    await enableTelemetry("telemetry", false);
    expect(reporter.userOptIn).to.eq(false); // disabled
  });

  it("should send an event", async () => {
    await telemetryListener.initialize();

    telemetryListener.sendCommandUsage("command-id", 1234, undefined);

    expect(
      TelemetryReporter.prototype.sendTelemetryEvent,
    ).to.have.been.calledOnceWith(
      "command-usage",
      {
        name: "command-id",
        status: "Success",
        isCanary,
      },
      { executionTime: 1234 },
    );

    expect(TelemetryReporter.prototype.sendTelemetryException).not.to.have.been
      .called;
  });

  it("should send a command usage event with an error", async () => {
    await telemetryListener.initialize();

    telemetryListener.sendCommandUsage(
      "command-id",
      1234,
      new UserCancellationException(),
    );

    expect(
      TelemetryReporter.prototype.sendTelemetryEvent,
    ).to.have.been.calledOnceWith(
      "command-usage",
      {
        name: "command-id",
        status: "Cancelled",
        isCanary,
      },
      { executionTime: 1234 },
    );

    expect(TelemetryReporter.prototype.sendTelemetryException).not.to.have.been
      .called;
  });

  it("should avoid sending an event when telemetry is disabled", async () => {
    await telemetryListener.initialize();
    await enableTelemetry("codeQL.telemetry", false);

    telemetryListener.sendCommandUsage("command-id", 1234, undefined);
    telemetryListener.sendCommandUsage("command-id", 1234, new Error());

    expect(TelemetryReporter.prototype.sendTelemetryEvent).not.to.have.been
      .called;
    expect(TelemetryReporter.prototype.sendTelemetryException).not.to.have.been
      .called;
  });

  it("should send an event when telemetry is re-enabled", async () => {
    await telemetryListener.initialize();
    await enableTelemetry("codeQL.telemetry", false);
    await enableTelemetry("codeQL.telemetry", true);

    telemetryListener.sendCommandUsage("command-id", 1234, undefined);

    expect(
      TelemetryReporter.prototype.sendTelemetryEvent,
    ).to.have.been.calledOnceWith(
      "command-usage",
      {
        name: "command-id",
        status: "Success",
        isCanary,
      },
      { executionTime: 1234 },
    );
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
    expect(res).to.eq(true);
    expect(envelop).to.deep.eq({
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

  it("should request permission if popup has never been seen before", async function () {
    this.timeout(3000);
    sandbox
      .stub(window, "showInformationMessage")
      .resolvesArg(3 /* "yes" item */);
    await ctx.globalState.update("telemetry-request-viewed", false);
    await enableTelemetry("codeQL.telemetry", false);

    await telemetryListener.initialize();

    // Wait for user's selection to propagate in settings.
    await wait(500);

    // Dialog opened, user clicks "yes" and telemetry enabled
    expect(window.showInformationMessage).to.have.been.calledOnce;
    expect(ENABLE_TELEMETRY.getValue()).to.eq(true);
    expect(ctx.globalState.get("telemetry-request-viewed")).to.be.true;
  });

  it("should prevent telemetry if permission is denied", async () => {
    sandbox
      .stub(window, "showInformationMessage")
      .resolvesArg(4 /* "no" item */);
    await ctx.globalState.update("telemetry-request-viewed", false);
    await enableTelemetry("codeQL.telemetry", true);

    await telemetryListener.initialize();

    // Dialog opened, user clicks "no" and telemetry disabled
    expect(window.showInformationMessage).to.have.been.calledOnce;
    expect(ENABLE_TELEMETRY.getValue()).to.eq(false);
    expect(ctx.globalState.get("telemetry-request-viewed")).to.be.true;
  });

  it("should unchange telemetry if permission dialog is dismissed", async () => {
    sandbox
      .stub(window, "showInformationMessage")
      .resolves(undefined /* cancelled */);
    await ctx.globalState.update("telemetry-request-viewed", false);

    // this causes requestTelemetryPermission to be called
    await enableTelemetry("codeQL.telemetry", false);

    // Dialog opened, and user closes without interacting with it
    expect(window.showInformationMessage).to.have.been.calledOnce;
    expect(ENABLE_TELEMETRY.getValue()).to.eq(false);
    // dialog was canceled, so should not have marked as viewed
    expect(ctx.globalState.get("telemetry-request-viewed")).to.be.false;
  });

  it("should unchange telemetry if permission dialog is cancelled if starting as true", async () => {
    await enableTelemetry("codeQL.telemetry", false);

    // as before, except start with telemetry enabled. It should _stay_ enabled if the
    // dialog is canceled.
    sandbox
      .stub(window, "showInformationMessage")
      .resolves(undefined /* cancelled */);
    await ctx.globalState.update("telemetry-request-viewed", false);

    // this causes requestTelemetryPermission to be called
    await enableTelemetry("codeQL.telemetry", true);

    // Dialog opened, and user closes without interacting with it
    // Telemetry state should not have changed
    expect(window.showInformationMessage).to.have.been.calledOnce;
    expect(ENABLE_TELEMETRY.getValue()).to.eq(true);
    // dialog was canceled, so should not have marked as viewed
    expect(ctx.globalState.get("telemetry-request-viewed")).to.be.false;
  });

  it("should avoid showing dialog if global telemetry is disabled", async () => {
    // when telemetry is disabled globally, we never want to show the
    // opt in/out dialog. We just assume that codeql telemetry should
    // remain disabled as well.
    // If the user ever turns global telemetry back on, then we can
    // show the dialog.

    await enableTelemetry("telemetry", false);
    await ctx.globalState.update("telemetry-request-viewed", false);
    sandbox.stub(window, "showInformationMessage");

    await telemetryListener.initialize();

    // popup should not be shown even though we have initialized telemetry
    expect(window.showInformationMessage).not.to.have.been.called;
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
    sandbox
      .stub(window, "showInformationMessage")
      .resolves(undefined /* cancelled */);

    // set canary to true
    await workspace.getConfiguration().update("codeQL.canary", true);

    // now, we should have to click through the telemetry requestor again
    expect(ctx.globalState.get("telemetry-request-viewed")).to.be.false;
    expect(window.showInformationMessage).to.have.been.calledOnce;
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
