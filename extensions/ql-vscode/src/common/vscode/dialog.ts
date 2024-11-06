import { window } from "vscode";

/**
 * Opens a modal dialog for the user to make a yes/no choice.
 *
 * @param message The message to show.
 * @param modal If true (the default), show a modal dialog box, otherwise dialog is non-modal and can
 *        be closed even if the user does not make a choice.
 * @param yesTitle The text in the box indicating the affirmative choice.
 * @param noTitle The text in the box indicating the negative choice.
 *
 * @return
 *  `true` if the user clicks 'Yes',
 *  `false` if the user clicks 'No' or cancels the dialog,
 *  `undefined` if the dialog is closed without the user making a choice.
 */
export async function showBinaryChoiceDialog(
  message: string,
  modal = true,
  yesTitle = "Yes",
  noTitle = "No",
): Promise<boolean | undefined> {
  const yesItem = { title: yesTitle, isCloseAffordance: false };
  const noItem = { title: noTitle, isCloseAffordance: true };
  const chosenItem = await window.showInformationMessage(
    message,
    { modal },
    yesItem,
    noItem,
  );
  if (!chosenItem) {
    return undefined;
  }
  return chosenItem?.title === yesItem.title;
}

/**
 * Show an information message with a customisable action.
 * @param message The message to show.
 * @param actionMessage The call to action message.
 *
 * @return `true` if the user clicks the action, `false` if the user cancels the dialog.
 */
export async function showInformationMessageWithAction(
  message: string,
  actionMessage: string,
): Promise<boolean> {
  const actionItem = { title: actionMessage, isCloseAffordance: false };
  const chosenItem = await window.showInformationMessage(message, actionItem);
  return chosenItem === actionItem;
}

/**
 * Opens a modal dialog for the user to make a choice between yes/no/never be asked again.
 *
 * @param message The message to show.
 * @param modal If true (the default), show a modal dialog box, otherwise dialog is non-modal and can
 *        be closed even if the user does not make a choice.
 * @param yesTitle The text in the box indicating the affirmative choice.
 * @param noTitle The text in the box indicating the negative choice.
 * @param neverTitle The text in the box indicating the opt out choice.
 *
 * @return
 *  `Yes` if the user clicks 'Yes',
 *  `No` if the user clicks 'No' or cancels the dialog,
 *  `No, and never ask me again` if the user clicks 'No, and never ask me again',
 *  `undefined` if the dialog is closed without the user making a choice.
 */
export async function showNeverAskAgainDialog(
  message: string,
  modal = true,
  yesTitle = "Yes",
  noTitle = "No",
  neverAskAgainTitle = "No, and never ask me again",
): Promise<string | undefined> {
  const yesItem = { title: yesTitle, isCloseAffordance: true };
  const noItem = { title: noTitle, isCloseAffordance: false };
  const neverAskAgainItem = {
    title: neverAskAgainTitle,
    isCloseAffordance: false,
  };
  const chosenItem = await window.showInformationMessage(
    message,
    { modal },
    yesItem,
    noItem,
    neverAskAgainItem,
  );

  return chosenItem?.title;
}
