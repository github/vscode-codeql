import { extensions, QuickPickItem, window } from "vscode";
import { join, resolve } from "path";

import { CodeQLCliServer } from "../../../src/cli";
import { CodeQLExtensionInterface } from "../../../src/extension";
import { getErrorMessage } from "../../../src/pure/helpers-pure";

import * as helpers from "../../../src/helpers";
import {
  handleDownloadPacks,
  handleInstallPackDependencies,
} from "../../../src/packaging";

// up to 3 minutes per test
jest.setTimeout(3 * 60 * 1000);

describe("Packaging commands", () => {
  let cli: CodeQLCliServer;
  const progress = jest.fn();
  let quickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;
  let inputBoxSpy: jest.SpiedFunction<typeof window.showInputBox>;
  let showAndLogExceptionWithTelemetrySpy: jest.SpiedFunction<
    typeof helpers.showAndLogExceptionWithTelemetry
  >;
  let showAndLogInformationMessageSpy: jest.SpiedFunction<
    typeof helpers.showAndLogInformationMessage
  >;
  let packInstallSpy: jest.SpiedFunction<typeof cli.packInstall>;

  beforeEach(async () => {
    quickPickSpy = jest
      .spyOn(window, "showQuickPick")
      .mockResolvedValue(undefined);
    inputBoxSpy = jest
      .spyOn(window, "showInputBox")
      .mockResolvedValue(undefined);
    showAndLogExceptionWithTelemetrySpy = jest
      .spyOn(helpers, "showAndLogExceptionWithTelemetry")
      .mockResolvedValue(undefined);
    showAndLogInformationMessageSpy = jest
      .spyOn(helpers, "showAndLogInformationMessage")
      .mockResolvedValue(undefined);

    const extension = await extensions
      .getExtension<CodeQLExtensionInterface | Record<string, never>>(
        "GitHub.vscode-codeql",
      )!
      .activate();
    if ("cliServer" in extension) {
      cli = extension.cliServer;
    } else {
      throw new Error(
        "Extension not initialized. Make sure cli is downloaded and installed properly.",
      );
    }

    packInstallSpy = jest
      .spyOn(cli, "packInstall")
      .mockResolvedValue(undefined);
  });

  it("should download all core query packs", async () => {
    quickPickSpy.mockResolvedValue(
      "Download all core query packs" as unknown as QuickPickItem,
    );

    await handleDownloadPacks(cli, progress);
    expect(showAndLogInformationMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining("Finished downloading packs."),
    );
  });

  it("should download valid user-specified pack", async () => {
    quickPickSpy.mockResolvedValue(
      "Download custom specified pack" as unknown as QuickPickItem,
    );
    inputBoxSpy.mockResolvedValue("codeql/csharp-solorigate-queries");

    await handleDownloadPacks(cli, progress);
    expect(showAndLogInformationMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining("Finished downloading packs."),
    );
  });

  it("should show error when downloading invalid user-specified pack", async () => {
    quickPickSpy.mockResolvedValue(
      "Download custom specified pack" as unknown as QuickPickItem,
    );
    inputBoxSpy.mockResolvedValue("foo/not-a-real-pack@0.0.1");

    await handleDownloadPacks(cli, progress);

    expect(showAndLogExceptionWithTelemetrySpy).toHaveBeenCalled();
    expect(
      showAndLogExceptionWithTelemetrySpy.mock.calls[0][0].fullMessage,
    ).toEqual("Unable to download all packs. See log for more details.");
  });

  it("should install valid workspace pack", async () => {
    const rootDir = join(__dirname, "./data");
    quickPickSpy.mockResolvedValue([
      {
        label: "integration-test-queries-javascript",
        packRootDir: [rootDir],
      },
    ] as unknown as QuickPickItem);

    await handleInstallPackDependencies(cli, progress);
    expect(showAndLogInformationMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining("Finished installing pack dependencies."),
    );
  });

  it("should throw an error when installing invalid workspace pack", async () => {
    const rootDir = join(__dirname, "../data-invalid-pack");
    quickPickSpy.mockResolvedValue([
      {
        label: "foo/bar",
        packRootDir: [rootDir],
      },
    ] as unknown as QuickPickItem);

    try {
      // expect this to throw an error
      await handleInstallPackDependencies(cli, progress);
      // This line should not be reached
      expect(true).toBe(false);
    } catch (e) {
      expect(getErrorMessage(e)).toContain(
        "Unable to install pack dependencies",
      );
    }
  });

  describe("when provided with a custom directory", () => {
    it("should install dependencies in the provided directory", async () => {
      await handleInstallPackDependencies(cli, progress, "custom-dir");
      expect(packInstallSpy).toHaveBeenCalledWith(resolve("custom-dir"));
      expect(showAndLogInformationMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining("Finished installing pack dependencies."),
      );
    });
  });
});
