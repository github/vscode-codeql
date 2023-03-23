import * as vscode from "vscode";
import { tryOpenExternalFile } from "../../../../../src/vscode-utils/external-files";
import { createMockCommandManager } from "../../../../__mocks__/commandsMock";
import { mockedObject } from "../../../utils/mocking.helpers";

describe("tryOpenExternalFile", () => {
  let showTextDocumentSpy: jest.SpiedFunction<
    typeof vscode.window.showTextDocument
  >;
  let showInformationMessageSpy: jest.SpiedFunction<
    typeof vscode.window.showInformationMessage
  >;

  beforeEach(() => {
    showTextDocumentSpy = jest
      .spyOn(vscode.window, "showTextDocument")
      .mockResolvedValue(mockedObject<vscode.TextEditor>({}));
    showInformationMessageSpy = jest
      .spyOn(vscode.window, "showInformationMessage")
      .mockResolvedValue(undefined);
  });

  it("should open an external file", async () => {
    const executeCommand = jest.fn();
    const commandManager = createMockCommandManager({ executeCommand });

    await tryOpenExternalFile(commandManager, "xxx");
    expect(showTextDocumentSpy).toHaveBeenCalledTimes(1);
    expect(showTextDocumentSpy).toHaveBeenCalledWith(
      vscode.Uri.file("xxx"),
      expect.anything(),
    );
    expect(executeCommand).not.toBeCalled();
  });

  [
    "too large to open",
    "Files above 50MB cannot be synchronized with extensions",
  ].forEach((msg) => {
    it(`should fail to open a file because "${msg}" and open externally`, async () => {
      const executeCommand = jest.fn();
      const commandManager = createMockCommandManager({ executeCommand });

      showTextDocumentSpy.mockRejectedValue(new Error(msg));
      showInformationMessageSpy.mockResolvedValue({ title: "Yes" });

      await tryOpenExternalFile(commandManager, "xxx");
      const uri = vscode.Uri.file("xxx");
      expect(showTextDocumentSpy).toHaveBeenCalledTimes(1);
      expect(showTextDocumentSpy).toHaveBeenCalledWith(uri, expect.anything());
      expect(executeCommand).toHaveBeenCalledWith("revealFileInOS", uri);
    });

    it(`should fail to open a file because "${msg}" and NOT open externally`, async () => {
      const executeCommand = jest.fn();
      const commandManager = createMockCommandManager({ executeCommand });

      showTextDocumentSpy.mockRejectedValue(new Error(msg));
      showInformationMessageSpy.mockResolvedValue({ title: "No" });

      await tryOpenExternalFile(commandManager, "xxx");
      const uri = vscode.Uri.file("xxx");
      expect(showTextDocumentSpy).toHaveBeenCalledTimes(1);
      expect(showTextDocumentSpy).toHaveBeenCalledWith(uri, expect.anything());
      expect(showInformationMessageSpy).toBeCalled();
      expect(executeCommand).not.toBeCalled();
    });
  });
});
