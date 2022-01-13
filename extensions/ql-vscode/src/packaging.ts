import { CodeQLCliServer } from './cli';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  getOnDiskWorkspaceFolders,
  showAndLogErrorMessage,
  showAndLogInformationMessage,
} from './helpers';
import { window } from 'vscode';
import { ProgressCallback } from './commandRunner';

const CORE_PACKS = [
  'codeql/cpp-all',
  'codeql/csharp-all',
  'codeql/go-all',
  'codeql/java-all',
  'codeql/javascript-all',
  'codeql/python-all',
  'codeql/ruby-all',
];

/**
 * Lists all workspace folders that contain a qlpack.yml file.
 *
 * Note: This currently only finds packs at the root of a workspace folder.
 * TODO: Add support for packs in subfolders.
 */
function getWorkspacePacks(): string[] {
  const packs: string[] = [];
  const workspaceFolders = getOnDiskWorkspaceFolders();
  for (const folder of workspaceFolders) {
    const qlpackYml = path.join(folder, 'qlpack.yml');
    if (fs.pathExistsSync(qlpackYml)) {
      packs.push(folder);
    }
  }
  return packs;
}

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
    message: 'Choose packs to download',
    step: 1,
    maxStep: 2,
  });
  let packsToDownload: string[] = [];
  const corePackOption = 'Download core CodeQL packs';
  const customPackOption = 'Download custom specified pack';
  const quickpick = await window.showQuickPick(
    [corePackOption, customPackOption],
    { ignoreFocusOut: true }
  );
  if (quickpick === corePackOption) {
    packsToDownload = CORE_PACKS;
  } else if (quickpick === customPackOption) {
    const customPack = await window.showInputBox({
      prompt:
        'Enter the <package-scope/name[@version]> of the pack to download',
      ignoreFocusOut: true,
    });
    if (customPack) {
      packsToDownload.push(customPack);
    } else {
      void showAndLogErrorMessage('No pack specified.');
    }
  }
  if (packsToDownload && packsToDownload.length > 0) {
    progress({
      message: `Downloading ${packsToDownload.join(', ')}`,
      step: 2,
      maxStep: 2,
    });
    for (const pack of packsToDownload) {
      try {
        await cliServer.packDownload(pack);
      } catch (error) {
        void showAndLogErrorMessage(`Unable to download pack ${pack}. See logs for more details.`);
      }
    }
    void showAndLogInformationMessage('Finished downloading packs.');
  }
}

/**
 * Prompts user to choose packs to install, and installs them.
 *
 * @param cliServer The CLI server.
 * @param progress A progress callback.
 */
export async function handleInstallPacks(
  cliServer: CodeQLCliServer,
  progress: ProgressCallback,
): Promise<void> {
  progress({
    message: 'Choose packs to install',
    step: 1,
    maxStep: 2,
  });
  let packsToInstall: string[] = [];
  const workspacePackOption = 'Install workspace packs';
  const customPackOption = 'Install custom specified pack';
  const quickpick = await window.showQuickPick(
    [workspacePackOption, customPackOption],
    { ignoreFocusOut: true }
  );
  if (quickpick === workspacePackOption) {
    packsToInstall = getWorkspacePacks();
  } else if (quickpick === customPackOption) {
    const customPack = await window.showInputBox({
      prompt:
        'Enter the root directory of the pack to install (as an absolute path)',
      ignoreFocusOut: true,
    });
    if (customPack) {
      packsToInstall.push(customPack);
    } else {
      void showAndLogErrorMessage('No pack specified.');
    }
  }
  if (packsToInstall && packsToInstall.length > 0) {
    progress({
      message: `Installing ${packsToInstall.join(', ')}`,
      step: 2,
      maxStep: 2,
    });
    for (const pack of packsToInstall) {
      try {
        await cliServer.packInstall(pack);
      } catch (error) {
        void showAndLogErrorMessage(`Unable to install pack ${pack}. See logs for more details.`);
      }
    }
    void showAndLogInformationMessage('Finished installing packs.');
  }
}
