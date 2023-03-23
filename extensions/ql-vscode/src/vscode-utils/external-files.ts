import { commands, Uri, window } from "vscode";
import {
  showAndLogExceptionWithTelemetry,
  showBinaryChoiceDialog,
} from "../helpers";
import { redactableError } from "../pure/errors";
import { asError, getErrorMessage, getErrorStack } from "../pure/helpers-pure";

export async function tryOpenExternalFile(fileLocation: string) {
  const uri = Uri.file(fileLocation);
  try {
    await window.showTextDocument(uri, { preview: false });
  } catch (e) {
    const msg = getErrorMessage(e);
    if (
      msg.includes("Files above 50MB cannot be synchronized with extensions") ||
      msg.includes("too large to open")
    ) {
      const res = await showBinaryChoiceDialog(
        `VS Code does not allow extensions to open files >50MB. This file
exceeds that limit. Do you want to open it outside of VS Code?

You can also try manually opening it inside VS Code by selecting
the file in the file explorer and dragging it into the workspace.`,
      );
      if (res) {
        try {
          await commands.executeCommand("revealFileInOS", uri);
        } catch (e) {
          void showAndLogExceptionWithTelemetry(
            redactableError(
              asError(e),
            )`Failed to reveal file in OS: ${getErrorMessage(e)}`,
          );
        }
      }
    } else {
      void showAndLogExceptionWithTelemetry(
        redactableError(asError(e))`Could not open file ${fileLocation}`,
        {
          fullMessage: `${getErrorMessage(e)}\n${getErrorStack(e)}`,
        },
      );
    }
  }
}
