import { window } from "vscode";
import { join } from "path";

import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import { getErrorMessage } from "../../../../src/common/helpers-pure";

import * as log from "../../../../src/common/logging/notifications";
import {
  handleDownloadPacks,
  handleInstallPackDependencies,
} from "../../../../src/packaging";
import { mockedQuickPickItem } from "../../utils/mocking.helpers";
import { getActivatedExtension } from "../../global.helper";
import type {
  showAndLogExceptionWithTelemetry,
  showAndLogInformationMessage,
} from "../../../../src/common/logging";
import * as workspaceFolders from "../../../../src/common/vscode/workspace-folders";
import { getOnDiskWorkspaceFolders } from "../../../../src/common/vscode/workspace-folders";
import { pathsEqual } from "../../../../src/common/files";

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
      expect.anything(),
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
      expect.anything(),
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
      showAndLogExceptionWithTelemetrySpy.mock.calls[0][2].fullMessage,
    ).toEqual("Unable to download all packs. See log for more details.");
  });

  it("should only show workspace packs", async () => {
    const originalWorkspaceFolders = getOnDiskWorkspaceFolders();

    // Remove the CodeQL workspace folder from the list of workspace folders
    // since that includes all the packs that are already in the package cache,
    // so the test would be useless if we included it since nothing would be
    // filtered out (except for maybe the distribution legacy-upgrades).
    jest
      .spyOn(workspaceFolders, "getOnDiskWorkspaceFolders")
      .mockReturnValue(
        originalWorkspaceFolders.filter(
          (folder) => !pathsEqual(folder, process.env.TEST_CODEQL_PATH ?? ""),
        ),
      );

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
    expect(quickPickSpy).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          label: "integration-test-debugger-javascript",
        }),
        expect.objectContaining({
          label: "semmle/has-extension",
        }),
        expect.objectContaining({
          label: "semmle/targets-extension",
        }),
        expect.objectContaining({
          label: "test-queries",
        }),
      ],
      expect.anything(),
    );
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
      expect.anything(),
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
