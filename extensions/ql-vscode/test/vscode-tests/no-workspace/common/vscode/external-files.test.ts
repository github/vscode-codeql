import type { TextEditor } from "vscode";
import { Uri, window } from "vscode";
import { tryOpenExternalFile } from "../../../../../src/common/vscode/external-files";
import { createMockCommandManager } from "../../../../__mocks__/commandsMock";
import { mockedObject } from "../../../utils/mocking.helpers";

describe("tryOpenExternalFile", () => {
  let showTextDocumentSpy: jest.SpiedFunction<typeof window.showTextDocument>;
  let showInformationMessageSpy: jest.SpiedFunction<
    typeof window.showInformationMessage
  >;

  beforeEach(() => {
    showTextDocumentSpy = jest
      .spyOn(window, "showTextDocument")
      .mockResolvedValue(mockedObject<TextEditor>({}));
    showInformationMessageSpy = jest
      .spyOn(window, "showInformationMessage")
      .mockResolvedValue(undefined);
  });

  it("should open an external file", async () => {
    const executeCommand = jest.fn();
    const commandManager = createMockCommandManager({ executeCommand });

    await tryOpenExternalFile(commandManager, "xxx");
    expect(showTextDocumentSpy).toHaveBeenCalledTimes(1);
    expect(showTextDocumentSpy).toHaveBeenCalledWith(
      Uri.file("xxx"),
      expect.anything(),
    );
    expect(executeCommand).not.toHaveBeenCalled();
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
      const uri = Uri.file("xxx");
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
      const uri = Uri.file("xxx");
      expect(showTextDocumentSpy).toHaveBeenCalledTimes(1);
      expect(showTextDocumentSpy).toHaveBeenCalledWith(uri, expect.anything());
      expect(showInformationMessageSpy).toHaveBeenCalled();
      expect(executeCommand).not.toHaveBeenCalled();
    });
  });
});
