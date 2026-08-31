import { env, Uri } from "vscode";
import { showInformationMessageWithAction } from "../../common/vscode/dialog";

export const codeQlCliReleaseNotesUrl =
  "https://github.com/github/codeql-cli-binaries/blob/main/CHANGELOG.md";

/**
 * Offers release notes after the extension updates its managed CodeQL CLI.
 */
export async function offerCodeQlCliReleaseNotes(
  updateMessage: string,
): Promise<void> {
  if (
    await showInformationMessageWithAction(updateMessage, "Show release notes")
  ) {
    await env.openExternal(Uri.parse(codeQlCliReleaseNotesUrl));
  }
}
