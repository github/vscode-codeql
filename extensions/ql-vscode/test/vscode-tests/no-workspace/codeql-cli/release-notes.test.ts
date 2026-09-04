import { env, Uri, window } from "vscode";
import type { MessageItem } from "vscode";
import {
  codeQlCliReleaseNotesUrl,
  offerCodeQlCliReleaseNotes,
} from "../../../../src/codeql-cli/distribution/release-notes";

describe("offerCodeQlCliReleaseNotes", () => {
  const updateMessage = 'CodeQL CLI updated to version "v2.23.0".';
  let showInformationMessageSpy: jest.SpiedFunction<
    typeof window.showInformationMessage
  >;
  let openExternalSpy: jest.SpiedFunction<typeof env.openExternal>;

  beforeEach(() => {
    showInformationMessageSpy = jest
      .spyOn(window, "showInformationMessage")
      .mockResolvedValue(undefined);
    openExternalSpy = jest.spyOn(env, "openExternal").mockResolvedValue(true);
  });

  it("opens the CLI changelog when the release-notes action is selected", async () => {
    showInformationMessageSpy.mockImplementationOnce((...args) =>
      Promise.resolve(args[1] as MessageItem),
    );

    await offerCodeQlCliReleaseNotes(updateMessage);

    expect(showInformationMessageSpy).toHaveBeenCalledWith(updateMessage, {
      title: "Show release notes",
      isCloseAffordance: false,
    });
    expect(openExternalSpy).toHaveBeenCalledWith(
      Uri.parse(codeQlCliReleaseNotesUrl),
    );
  });

  it("does not open the changelog when the message is dismissed", async () => {
    await offerCodeQlCliReleaseNotes(updateMessage);

    expect(openExternalSpy).not.toHaveBeenCalled();
  });
});
