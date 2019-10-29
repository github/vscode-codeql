import { window as Window, CancellationToken, ProgressOptions } from 'vscode';
import { logger } from './logging';

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

/**
 * Used to perform compile time exhaustivity checking on a value.  This function will not be
 * executed at runtime unless there is a flaw in the type system.
 */
export function assertNever(value: never): never {
  logger.log("Internal error: assertNever failure");
  return value;
}
