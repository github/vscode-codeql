import { window as Window } from 'vscode';
import { logger } from './logging';

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
 * Used to perform compile time exhaustivity checking on a value.  This function will not be
 * executed at runtime unless there is a flaw in the type system.
 */
export function assertNever(value: never): never {
  logger.log("Internal error: assertNever failure");
  return value;
}
