import * as vscode from "vscode";
import { tryOpenExternalFile } from "../../../../../src/vscode-utils/external-files";
import { mockedObject } from "../../../utils/mocking.helpers";

describe("tryOpenExternalFile", () => {
  let showTextDocumentSpy: jest.SpiedFunction<
    typeof vscode.window.showTextDocument
  >;
  let showInformationMessageSpy: jest.SpiedFunction<
    typeof vscode.window.showInformationMessage
  >;
  let executeCommandSpy: jest.SpiedFunction<
    typeof vscode.commands.executeCommand
  >;

  beforeEach(() => {
    showTextDocumentSpy = jest
      .spyOn(vscode.window, "showTextDocument")
      .mockResolvedValue(mockedObject<vscode.TextEditor>({}));
    showInformationMessageSpy = jest
      .spyOn(vscode.window, "showInformationMessage")
      .mockResolvedValue(undefined);
    executeCommandSpy = jest
      .spyOn(vscode.commands, "executeCommand")
      .mockResolvedValue(undefined);
  });

  it("should open an external file", async () => {
    await tryOpenExternalFile("xxx");
    expect(showTextDocumentSpy).toHaveBeenCalledTimes(1);
    expect(showTextDocumentSpy).toHaveBeenCalledWith(
      vscode.Uri.file("xxx"),
      expect.anything(),
    );
    expect(executeCommandSpy).not.toBeCalled();
  });

  [
    "too large to open",
    "Files above 50MB cannot be synchronized with extensions",
  ].forEach((msg) => {
    it(`should fail to open a file because "${msg}" and open externally`, async () => {
      showTextDocumentSpy.mockRejectedValue(new Error(msg));
      showInformationMessageSpy.mockResolvedValue({ title: "Yes" });

      await tryOpenExternalFile("xxx");
      const uri = vscode.Uri.file("xxx");
      expect(showTextDocumentSpy).toHaveBeenCalledTimes(1);
      expect(showTextDocumentSpy).toHaveBeenCalledWith(uri, expect.anything());
      expect(executeCommandSpy).toHaveBeenCalledWith("revealFileInOS", uri);
    });

    it(`should fail to open a file because "${msg}" and NOT open externally`, async () => {
      showTextDocumentSpy.mockRejectedValue(new Error(msg));
      showInformationMessageSpy.mockResolvedValue({ title: "No" });

      await tryOpenExternalFile("xxx");
      const uri = vscode.Uri.file("xxx");
      expect(showTextDocumentSpy).toHaveBeenCalledTimes(1);
      expect(showTextDocumentSpy).toHaveBeenCalledWith(uri, expect.anything());
      expect(showInformationMessageSpy).toBeCalled();
      expect(executeCommandSpy).not.toBeCalled();
    });
  });
});
