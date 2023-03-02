import { CodeQLCliServer } from "./cli";
import {
  getOnDiskWorkspaceFolders,
  showAndLogExceptionWithTelemetry,
  showAndLogInformationMessage,
} from "./helpers";
import { QuickPickItem, window, workspace } from "vscode";
import { ProgressCallback, UserCancellationException } from "./commandRunner";
import { extLogger } from "./common";
import { asError, getErrorStack } from "./pure/helpers-pure";
import { redactableError } from "./pure/errors";
import { PACKS_BY_QUERY_LANGUAGE } from "./common/query-language";
import { join, resolve } from "path";

/**
 * Prompts user to choose packs to download, and downloads them.
 *
 * @param cliServer The CLI server.
 * @param progress A progress callback.
 */
export async function handleDownloadPacks(
  cliServer: CodeQLCliServer,
  progress: ProgressCallback,
): Promise<void> {
  progress({
    message: "Choose packs to download",
    step: 1,
    maxStep: 2,
  });
  let packsToDownload: string[] = [];
  const queryPackOption = "Download all core query packs";
  const customPackOption = "Download custom specified pack";
  const quickpick = await window.showQuickPick(
    [queryPackOption, customPackOption],
    { ignoreFocusOut: true },
  );
  if (quickpick === queryPackOption) {
    packsToDownload = Object.values(PACKS_BY_QUERY_LANGUAGE).flat();
  } else if (quickpick === customPackOption) {
    const customPack = await window.showInputBox({
      prompt:
        "Enter the <package-scope/name[@version]> of the pack to download",
      ignoreFocusOut: true,
    });
    if (customPack) {
      packsToDownload.push(customPack);
    } else {
      throw new UserCancellationException("No pack specified.");
    }
  }
  if (packsToDownload?.length > 0) {
    progress({
      message: "Downloading packs. This may take a few minutes.",
      step: 2,
      maxStep: 2,
    });
    try {
      await cliServer.packDownload(packsToDownload);
      void showAndLogInformationMessage("Finished downloading packs.");
    } catch (error) {
      void showAndLogExceptionWithTelemetry(
        redactableError(
          asError(error),
        )`Unable to download all packs. See log for more details.`,
        {
          fullMessage: getErrorStack(error),
        },
      );
    }
  }
}

interface QLPackQuickPickItem extends QuickPickItem {
  packRootDir: string[];
}

/**
 * Prompts user to choose packs to install, and installs them.
 *
 * @param cliServer The CLI server.
 * @param progress A progress callback.
 */
export async function handleInstallPackDependencies(
  cliServer: CodeQLCliServer,
  progress: ProgressCallback,
  relativeDirectoryPath?: string,
): Promise<void> {
  progress({
    message: "Choose packs to install dependencies for",
    step: 1,
    maxStep: 2,
  });

  let packsToInstall: QLPackQuickPickItem[] | undefined;

  if (relativeDirectoryPath) {
    const dirPath = resolve(
      join(workspace.rootPath || "", relativeDirectoryPath),
    );

    packsToInstall = [
      {
        label: relativeDirectoryPath,
        packRootDir: [dirPath],
      },
    ];
  } else {
    const workspacePacks = await cliServer.resolveQlpacks(
      getOnDiskWorkspaceFolders(),
    );
    const quickPickItems = Object.entries(
      workspacePacks,
    ).map<QLPackQuickPickItem>(([key, value]) => ({
      label: key,
      packRootDir: value,
    }));
    packsToInstall = await window.showQuickPick(quickPickItems, {
      placeHolder: "Select packs to install dependencies for",
      canPickMany: true,
      ignoreFocusOut: true,
    });
  }

  const numberOfPacks = packsToInstall?.length || 0;
  if (packsToInstall && numberOfPacks > 0) {
    const failedPacks = [];
    const errors = [];
    // Start at 1 because we already have the first step
    let count = 1;
    for (const pack of packsToInstall) {
      count++;
      progress({
        message: `Installing dependencies for ${pack.label}`,
        step: count,
        maxStep: numberOfPacks + 1,
      });
      try {
        for (const dir of pack.packRootDir) {
          await cliServer.packInstall(dir);
        }
      } catch (error) {
        failedPacks.push(pack.label);
        errors.push(error);
      }
    }
    if (failedPacks.length > 0) {
      void extLogger.log(`Errors:\n${errors.join("\n")}`);
      throw new Error(
        `Unable to install pack dependencies for: ${failedPacks.join(
          ", ",
        )}. See log for more details.`,
      );
    } else {
      void showAndLogInformationMessage(
        "Finished installing pack dependencies.",
      );
    }
  } else {
    throw new UserCancellationException("No packs selected.");
  }
}
