import type { AppCommandManager } from "../common/commands";
import { Uri, workspace } from "vscode";
import { join } from "path";
import { pathExists } from "fs-extra";
import { isCodespacesTemplate } from "../config";
import { showBinaryChoiceDialog } from "../common/vscode/dialog";
import { extLogger } from "../common/logging/vscode";

/**
 * Check if the current workspace is the CodeTour and open the workspace folder.
 * Without this, we can't run the code tour correctly.
 **/
export async function prepareCodeTour(
  commandManager: AppCommandManager,
): Promise<void> {
  if (workspace.workspaceFolders?.length) {
    const currentFolder = workspace.workspaceFolders[0].uri.fsPath;

    const tutorialWorkspacePath = join(
      currentFolder,
      "tutorial.code-workspace",
    );
    const toursFolderPath = join(currentFolder, ".tours");

    /** We're opening the tutorial workspace, if we detect it.
     * This will only happen if the following three conditions are met:
     * - the .tours folder exists
     * - the tutorial.code-workspace file exists
     * - the CODESPACES_TEMPLATE setting doesn't exist (it's only set if the user has already opened
     * the tutorial workspace so it's a good indicator that the user is in the folder but has ignored
     * the prompt to open the workspace)
     */
    if (
      (await pathExists(tutorialWorkspacePath)) &&
      (await pathExists(toursFolderPath)) &&
      !isCodespacesTemplate()
    ) {
      const answer = await showBinaryChoiceDialog(
        "We've detected you're in the CodeQL Tour repo. We will need to open the workspace file to continue. Reload?",
      );

      if (!answer) {
        return;
      }

      const tutorialWorkspaceUri = Uri.file(tutorialWorkspacePath);

      void extLogger.log(
        `In prepareCodeTour() method, going to open the tutorial workspace file: ${tutorialWorkspacePath}`,
      );

      await commandManager.execute("vscode.openFolder", tutorialWorkspaceUri);
    }
  }
}
