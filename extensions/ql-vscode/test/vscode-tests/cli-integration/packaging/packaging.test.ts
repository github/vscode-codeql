import { window } from "vscode";
import { join } from "path";

import { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import { getErrorMessage } from "../../../../src/pure/helpers-pure";

import * as log from "../../../../src/common/vscode/log";
import {
  handleDownloadPacks,
  handleInstallPackDependencies,
} from "../../../../src/packaging";
import { mockedQuickPickItem } from "../../utils/mocking.helpers";
import { getActivatedExtension } from "../../global.helper";
import {
  showAndLogExceptionWithTelemetry,
  showAndLogInformationMessage,
} from "../../../../src/common/vscode/log";

describe("Packaging commands", () => {
  let cli: CodeQLCliServer;
  const progress = jest.fn();
  let quickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;
  let inputBoxSpy: jest.SpiedFunction<typeof window.showInputBox>;
  let showAndLogExceptionWithTelemetrySpy: jest.SpiedFunction<
    typeof showAndLogExceptionWithTelemetry
  >;
  let showAndLogInformationMessageSpy: jest.SpiedFunction<
    typeof showAndLogInformationMessage
  >;

  beforeEach(async () => {
    quickPickSpy = jest
      .spyOn(window, "showQuickPick")
      .mockResolvedValue(undefined);
    inputBoxSpy = jest
      .spyOn(window, "showInputBox")
      .mockResolvedValue(undefined);
    showAndLogExceptionWithTelemetrySpy = jest
      .spyOn(log, "showAndLogExceptionWithTelemetry")
      .mockResolvedValue(undefined);
    showAndLogInformationMessageSpy = jest
      .spyOn(log, "showAndLogInformationMessage")
      .mockResolvedValue(undefined);

    const extension = await getActivatedExtension();
    cli = extension.cliServer;
  });

  it("should download all core query packs", async () => {
    quickPickSpy.mockResolvedValue(
      mockedQuickPickItem("Download all core query packs"),
    );

    await handleDownloadPacks(cli, progress);
    expect(showAndLogExceptionWithTelemetrySpy).not.toHaveBeenCalled();
    expect(showAndLogInformationMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining("Finished downloading packs."),
    );
  });

  it("should download valid user-specified pack", async () => {
    quickPickSpy.mockResolvedValue(
      mockedQuickPickItem("Download custom specified pack"),
    );
    inputBoxSpy.mockResolvedValue("codeql/csharp-solorigate-queries");

    await handleDownloadPacks(cli, progress);
    expect(showAndLogExceptionWithTelemetrySpy).not.toHaveBeenCalled();
    expect(showAndLogInformationMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining("Finished downloading packs."),
    );
  });

  it("should show error when downloading invalid user-specified pack", async () => {
    quickPickSpy.mockResolvedValue(
      mockedQuickPickItem("Download custom specified pack"),
    );
    inputBoxSpy.mockResolvedValue("foo/not-a-real-pack@0.0.1");

    await handleDownloadPacks(cli, progress);

    expect(showAndLogExceptionWithTelemetrySpy).toHaveBeenCalled();
    expect(
      showAndLogExceptionWithTelemetrySpy.mock.calls[0][1].fullMessage,
    ).toEqual("Unable to download all packs. See log for more details.");
  });

  it("should install valid workspace pack", async () => {
    const rootDir = join(__dirname, "../data");
    quickPickSpy.mockResolvedValue(
      mockedQuickPickItem([
        {
          label: "integration-test-queries-javascript",
          packRootDir: [rootDir],
        },
      ]),
    );

    await handleInstallPackDependencies(cli, progress);
    expect(showAndLogInformationMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining("Finished installing pack dependencies."),
    );
  });

  it("should throw an error when installing invalid workspace pack", async () => {
    const rootDir = join(__dirname, "../../data-invalid-pack");
    quickPickSpy.mockResolvedValue(
      mockedQuickPickItem([
        {
          label: "foo/bar",
          packRootDir: [rootDir],
        },
      ]),
    );

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
