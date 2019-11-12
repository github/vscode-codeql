import * as path from 'path';
import { CancellationToken, ProgressOptions, window as Window, workspace } from 'vscode';
import { logger } from './logging';
import { EvaluationInfo } from './queries';

export interface ProgressUpdate {
  /**
   * The current step
   */
  step: number;
  /**
   * The maximum step. This *should* be constant for a single job.
   */
  maxStep: number;
  /**
   * The current progress message
   */
  message: string;
}

/**
 * This mediates between the kind of progress callbacks we want to
 * write (where we *set* current progress position and give
 * `maxSteps`) and the kind vscode progress api expects us to write
 * (which increment progress by a certain amount out of 100%)
 */
export function withProgress<R>(
  options: ProgressOptions,
  task: (
    progress: (p: ProgressUpdate) => void,
    token: CancellationToken
  ) => Thenable<R>
): Thenable<R> {
  let progressAchieved = 0;
  return Window.withProgress(options,
    (progress, token) => {
      return task(p => {
        const { message, step, maxStep } = p;
        const increment = 100 * (step - progressAchieved) / maxStep;
        progressAchieved = step;
        progress.report({ message, increment });
      }, token);
    });
}

/**
 * Show an error message and log it to the console
 *
 * @param message — The message to show.
 * @param items — A set of items that will be rendered as actions in the message.
 *
 * @return — A thenable that resolves to the selected item or undefined when being dismissed.
 */
export function showAndLogErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> {
  logger.log(message);
  return Window.showErrorMessage(message, ...items);
}
/**
 * Show a warning message and log it to the console
 *
 * @param message — The message to show.
 * @param items — A set of items that will be rendered as actions in the message.
 *
 * @return — A thenable that resolves to the selected item or undefined when being dismissed.
 */
export function showAndLogWarningMessage(message: string, ...items: string[]): Thenable<string | undefined> {
  logger.log(message);
  return Window.showWarningMessage(message, ...items);
}
/**
 * Show an information message and log it to the console
 *
 * @param message — The message to show.
 * @param items — A set of items that will be rendered as actions in the message.
 *
 * @return — A thenable that resolves to the selected item or undefined when being dismissed.
 */
export function showAndLogInformationMessage(message: string, ...items: string[]): Thenable<string | undefined> {
  logger.log(message);
  return Window.showInformationMessage(message, ...items);
}

/**
 * Opens a modal dialog for the user to make a yes/no choice.
 * @param message — The message to show.
 *
 * @return — `true` if the user clicks 'Yes', `false` if the user clicks 'No' or cancels the dialog.
 */
export async function showBinaryChoiceDialog(message: string): Promise<boolean> {
  const yesItem = { title: 'Yes', isCloseAffordance: false };
  const noItem = { title: 'No', isCloseAffordance: true }
  const chosenItem = await Window.showInformationMessage(message, { modal: true }, yesItem, noItem);
  return chosenItem === yesItem;
}

/**
 * Show an information message with a customisable action.
 * @param message — The message to show.
 * @param actionMessage - The call to action message.
 *
 * @return — `true` if the user clicks the action, `false` if the user cancels the dialog.
 */
export async function showInformationMessageWithAction(message: string, actionMessage: string): Promise<boolean> {
  const actionItem = { title: actionMessage, isCloseAffordance: false };
  const chosenItem = await Window.showInformationMessage(message, actionItem);
  return chosenItem === actionItem;
}

/** Gets all active workspace folders that are on the filesystem. */
export function getOnDiskWorkspaceFolders() {
  const workspaceFolders = workspace.workspaceFolders || [];
  let diskWorkspaceFolders: string[] = [];
  for (const workspaceFolder of workspaceFolders) {
    if (workspaceFolder.uri.scheme === "file")
      diskWorkspaceFolders.push(workspaceFolder.uri.fsPath)
  }
  return diskWorkspaceFolders;
}

/**
 * Gets a human-readable name for an evaluated query.
 * Uses metadata if it exists, and defaults to the query file name.
 */
export function getQueryName(info: EvaluationInfo) {
  // Queries run through quick evaluation are not usually the entire query file.
  // Label them differently and include the line numbers.
  if (info.query.quickEvalPosition !== undefined) {
    const { line, endLine, fileName } = info.query.quickEvalPosition;
    const lineInfo = line === endLine ? `${line}` : `${line}-${endLine}`;
    return `Quick evaluation of ${path.basename(fileName)}:${lineInfo}`;
  } else if (info.query.metadata && info.query.metadata.name) {
    return info.query.metadata.name;
  } else {
    return path.basename(info.query.program.queryPath);
  }
}
