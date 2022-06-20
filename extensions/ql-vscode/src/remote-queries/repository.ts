import { window } from 'vscode';
import { getRemoteControllerRepo, setRemoteControllerRepo } from '../config';
import { REPO_REGEX } from '../pure/helpers-pure';
import { logger } from '../logging';
import { showAndLogErrorMessage } from '../helpers';

export interface Repository {
  owner: string;
  name: string;
}

/**
 * Gets the controller repo from the config, if it exists.
 * If it doesn't exist, prompt the user to enter it, and save that value to the config.
 * @returns the controller repo: owner/name
 */

export async function getControllerRepoSelection(): Promise<string | undefined> {
  let controllerRepo: string | undefined;
  controllerRepo = getRemoteControllerRepo();
  if (!controllerRepo || !REPO_REGEX.test(controllerRepo)) {
    void logger.log(controllerRepo ? 'Invalid controller repository name.' : 'No controller repository defined.');
    controllerRepo = await window.showInputBox({
      title: 'Controller repository in which to display progress and results of variant analysis',
      placeHolder: '<owner>/<repo>',
      prompt: 'Enter the name of a GitHub repository in the format <owner>/<repo>',
      ignoreFocusOut: true,
    });
    if (!controllerRepo) {
      void showAndLogErrorMessage('No controller repository entered.');
      return "";
    } else if (!REPO_REGEX.test(controllerRepo)) { // Check if user entered invalid input
      void showAndLogErrorMessage('Invalid repository format. Must be a valid GitHub repository in the format <owner>/<repo>.');
      return "";
    } else {
      return "";
    }
  }

  void logger.log(`Setting the controller repository as: ${controllerRepo}`);
  await setRemoteControllerRepo(controllerRepo);
}
