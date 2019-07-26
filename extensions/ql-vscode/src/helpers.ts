import { window as Window } from 'vscode';

/**
 * Show an error message and log it to the console
 * 
 * @param message — The message to show.
 * @param items — A set of items that will be rendered as actions in the message.
 * 
 * @return — A thenable that resolves to the selected item or undefined when being dismissed.
 */
export function showAndLogErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> {
  console.error(message);
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
  console.warn(message);
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
  console.info(message);
  return Window.showInformationMessage(message, ...items);
}
