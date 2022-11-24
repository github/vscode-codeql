import { extensions, QuickPickItem, window } from "vscode";
import * as path from "path";

import { CodeQLCliServer } from "../../cli";
import { CodeQLExtensionInterface } from "../../extension";
import { getErrorMessage } from "../../pure/helpers-pure";

import * as helpers from "../../helpers";
import {
  handleDownloadPacks,
  handleInstallPackDependencies,
} from "../../packaging";

// up to 3 minutes per test
jest.setTimeout(3 * 60 * 1000);

describe("Packaging commands", () => {
  let cli: CodeQLCliServer;
  const progress = jest.fn();
  let quickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;
  let inputBoxSpy: jest.SpiedFunction<typeof window.showInputBox>;
  let showAndLogErrorMessageSpy: jest.SpiedFunction<
    typeof helpers.showAndLogErrorMessage
  >;
  let showAndLogInformationMessageSpy: jest.SpiedFunction<
    typeof helpers.showAndLogInformationMessage
  >;

  beforeEach(async () => {
    quickPickSpy = jest
      .spyOn(window, "showQuickPick")
      .mockResolvedValue(undefined);
    inputBoxSpy = jest
      .spyOn(window, "showInputBox")
      .mockResolvedValue(undefined);
    showAndLogErrorMessageSpy = jest
      .spyOn(helpers, "showAndLogErrorMessage")
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

    expect(showAndLogErrorMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unable to download all packs."),
    );
  });

  it("should install valid workspace pack", async () => {
    const rootDir = path.join(
      __dirname,
      "../../../src/vscode-tests/cli-integration/data",
    );
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
    const rootDir = path.join(
      __dirname,
      "../../../src/vscode-tests/cli-integration/data-invalid-pack",
    );
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
});
