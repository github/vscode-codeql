import TelemetryReporter from "vscode-extension-telemetry";
import { workspace, env } from "vscode";
import {
  ExtensionTelemetryListener,
  telemetryListener as globalTelemetryListener,
} from "../../../src/common/vscode/telemetry";
import { UserCancellationException } from "../../../src/common/vscode/progress";
import { redactableError } from "../../../src/common/errors";
import { SemVer } from "semver";

// setting preferences can trigger lots of background activity
// so need to bump up the timeout of this test.
jest.setTimeout(10000);

describe("telemetry reporting", () => {
  let isCanary: string;
  let telemetryListener: ExtensionTelemetryListener;

  let sendTelemetryEventSpy: jest.SpiedFunction<
    typeof TelemetryReporter.prototype.sendTelemetryEvent
  >;
  let sendTelemetryErrorEventSpy: jest.SpiedFunction<
    typeof TelemetryReporter.prototype.sendTelemetryErrorEvent
  >;

  beforeEach(async () => {
    try {
      // in case a previous test has accidentally activated this extension,
      // need to disable it first.
      // Accidental activation may happen asynchronously due to activationEvents
      // specified in the package.json.
      globalTelemetryListener?.dispose();

      sendTelemetryEventSpy = jest
        .spyOn(TelemetryReporter.prototype, "sendTelemetryEvent")
        .mockReturnValue(undefined);
      sendTelemetryErrorEventSpy = jest
        .spyOn(TelemetryReporter.prototype, "sendTelemetryErrorEvent")
        .mockReturnValue(undefined);

      isCanary = (!!workspace
        .getConfiguration()
        .get<boolean>("codeQL.canary")).toString();

      // each test will default to telemetry being enabled
      jest.spyOn(env, "isTelemetryEnabled", "get").mockReturnValue(true);

      telemetryListener = new ExtensionTelemetryListener(
        "my-id",
        "1.2.3",
        "fake-key",
      );
      await wait(100);
    } catch (e) {
      console.error(e);
    }
  });

  afterEach(async () => {
    telemetryListener?.dispose();
  });

  it("should initialize telemetry", async () => {
    expect(telemetryListener._reporter).toBeDefined();
    const reporter: any = telemetryListener._reporter;
    expect(reporter.extensionId).toBe("my-id");
    expect(reporter.extensionVersion).toBe("1.2.3");
    expect(reporter.userOptIn).toBe(true); // enabled
  });

  it("should send an event", async () => {
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
    expect(sendTelemetryErrorEventSpy).not.toHaveBeenCalled();
  });

  it("should send a command usage event with an error", async () => {
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
    expect(sendTelemetryErrorEventSpy).not.toHaveBeenCalled();
  });

  it("should send a command usage event with a cli version", async () => {
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
    expect(sendTelemetryErrorEventSpy).not.toHaveBeenCalled();

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
    expect(sendTelemetryErrorEventSpy).not.toHaveBeenCalled();
  });

  it("should filter undesired properties from telemetry payload", async () => {
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

  it("should send a ui-interaction telemetry event", async () => {
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
    expect(sendTelemetryErrorEventSpy).not.toHaveBeenCalled();
  });

  it("should send a ui-interaction telemetry event with a cli version", async () => {
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
    expect(sendTelemetryErrorEventSpy).not.toHaveBeenCalled();
  });

  it("should send an error telemetry event", async () => {
    telemetryListener.sendError(redactableError`test`);

    expect(sendTelemetryEventSpy).not.toHaveBeenCalled();
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

  it("should send an error telemetry event with a cli version", async () => {
    telemetryListener.cliVersion = new SemVer("1.2.3");

    telemetryListener.sendError(redactableError`test`);

    expect(sendTelemetryEventSpy).not.toHaveBeenCalled();
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
    telemetryListener.sendError(
      redactableError`test message with secret information: ${42} and more ${"secret"} parts`,
    );

    expect(sendTelemetryEventSpy).not.toHaveBeenCalled();
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

  it("should send config telemetry event", async () => {
    telemetryListener.sendConfigInformation({
      testKey: "testValue",
      testKey2: "42",
    });

    expect(sendTelemetryEventSpy).toHaveBeenCalledWith(
      "config",
      {
        testKey: "testValue",
        testKey2: "42",
        isCanary: "false",
        cliVersion: "not-set",
      },
      {},
    );
    expect(sendTelemetryErrorEventSpy).not.toHaveBeenCalled();
  });

  async function wait(ms = 0) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
});
