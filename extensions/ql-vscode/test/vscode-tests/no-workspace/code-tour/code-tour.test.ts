import type { WorkspaceFolder } from "vscode";
import { Uri, window, workspace } from "vscode";
import type { DirResult } from "tmp";
import { dirSync } from "tmp";
import { join } from "path";
import { mkdir, writeFile } from "fs-extra";

import { prepareCodeTour } from "../../../../src/code-tour/code-tour";
import { Setting } from "../../../../src/config";
import { createMockCommandManager } from "../../../__mocks__/commandsMock";

describe("prepareCodeTour", () => {
  let dir: DirResult;
  let showInformationMessageSpy: jest.SpiedFunction<
    typeof window.showInformationMessage
  >;

  beforeEach(() => {
    dir = dirSync({
      unsafeCleanup: true,
    });

    const mockWorkspaceFolders = [
      {
        uri: Uri.file(dir.name),
        name: "test",
        index: 0,
      },
    ] as WorkspaceFolder[];

    jest
      .spyOn(workspace, "workspaceFolders", "get")
      .mockReturnValue(mockWorkspaceFolders);

    showInformationMessageSpy = jest
      .spyOn(window, "showInformationMessage")
      .mockResolvedValue({ title: "Yes" });
  });

  afterEach(() => {
    dir.removeCallback();
  });

  describe("if we're in the tour repo", () => {
    describe("if the workspace is not already open", () => {
      it("should open the tutorial workspace", async () => {
        // set up directory to have a 'tutorial.code-workspace' file
        const tutorialWorkspacePath = join(dir.name, "tutorial.code-workspace");
        await writeFile(tutorialWorkspacePath, "{}");

        // set up a .tours directory to indicate we're in the tour codespace
        const tourDirPath = join(dir.name, ".tours");
        await mkdir(tourDirPath);

        // spy that we open the workspace file by calling the 'vscode.openFolder' command
        const executeCommand = jest.fn();
        await prepareCodeTour(createMockCommandManager({ executeCommand }));

        expect(showInformationMessageSpy).toHaveBeenCalled();
        expect(executeCommand).toHaveBeenCalledWith(
          "vscode.openFolder",
          expect.objectContaining({
            path: expect.stringMatching(/tutorial.code-workspace$/),
          }),
        );
      });
    });

    describe("if the workspace is already open", () => {
      it("should not open the tutorial workspace", async () => {
        // Set isCodespacesTemplate to true to indicate the workspace has already been opened
        jest.spyOn(Setting.prototype, "getValue").mockReturnValue(true);

        // set up directory to have a 'tutorial.code-workspace' file
        const tutorialWorkspacePath = join(dir.name, "tutorial.code-workspace");
        await writeFile(tutorialWorkspacePath, "{}");

        // set up a .tours directory to indicate we're in the tour codespace
        const tourDirPath = join(dir.name, ".tours");
        await mkdir(tourDirPath);

        // spy that we open the workspace file by calling the 'vscode.openFolder' command
        const executeCommand = jest.fn();
        await prepareCodeTour(createMockCommandManager({ executeCommand }));

        expect(executeCommand).not.toHaveBeenCalled();
      });
    });
  });

  describe("if we're in a different tour repo", () => {
    it("should not open the tutorial workspace", async () => {
      // set up a .tours directory
      const tourDirPath = join(dir.name, ".tours");
      await mkdir(tourDirPath);

      // spy that we open the workspace file by calling the 'vscode.openFolder' command
      const executeCommand = jest.fn();
      await prepareCodeTour(createMockCommandManager({ executeCommand }));

      expect(executeCommand).not.toHaveBeenCalled();
    });
  });

  describe("if we're in a different repo with no tour", () => {
    it("should not open the tutorial workspace", async () => {
      // spy that we open the workspace file by calling the 'vscode.openFolder' command
      const executeCommand = jest.fn();
      await prepareCodeTour(createMockCommandManager({ executeCommand }));

      expect(executeCommand).not.toHaveBeenCalled();
    });
  });
});
