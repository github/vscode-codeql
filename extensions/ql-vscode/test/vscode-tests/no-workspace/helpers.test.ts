import { Uri, window, workspace, WorkspaceFolder } from "vscode";
import * as tmp from "tmp";
import { join } from "path";
import { writeFile, mkdir } from "fs-extra";

import { prepareCodeTour } from "../../../src/helpers";
import { reportStreamProgress } from "../../../src/common/vscode/progress";
import { Setting } from "../../../src/config";
import { createMockCommandManager } from "../../__mocks__/commandsMock";

describe("helpers", () => {
  it("should report stream progress", () => {
    const progressSpy = jest.fn();
    const mockReadable = {
      on: jest.fn(),
    };
    const max = 1024 * 1024 * 4;
    const firstStep = 1024 * 1024 + 1024 * 600;
    const secondStep = 1024 * 1024 * 2;

    (reportStreamProgress as any)(mockReadable, "My prefix", max, progressSpy);

    // now pretend that we have received some messages
    const listener = mockReadable.on.mock.calls[0][1] as (data: any) => void;
    listener({ length: firstStep });
    listener({ length: secondStep });

    expect(progressSpy).toBeCalledTimes(3);
    expect(progressSpy).toBeCalledWith({
      step: 0,
      maxStep: max,
      message: "My prefix [0.0 MB of 4.0 MB]",
    });
    expect(progressSpy).toBeCalledWith({
      step: firstStep,
      maxStep: max,
      message: "My prefix [1.6 MB of 4.0 MB]",
    });
    expect(progressSpy).toBeCalledWith({
      step: firstStep + secondStep,
      maxStep: max,
      message: "My prefix [3.6 MB of 4.0 MB]",
    });
  });

  it("should report stream progress when total bytes unknown", () => {
    const progressSpy = jest.fn();
    const mockReadable = {
      on: jest.fn(),
    };
    (reportStreamProgress as any)(
      mockReadable,
      "My prefix",
      undefined,
      progressSpy,
    );

    // There are no listeners registered to this readable
    expect(mockReadable.on).not.toBeCalled();

    expect(progressSpy).toBeCalledTimes(1);
    expect(progressSpy).toBeCalledWith({
      step: 1,
      maxStep: 2,
      message: "My prefix (Size unknown)",
    });
  });
});

describe("prepareCodeTour", () => {
  let dir: tmp.DirResult;
  let showInformationMessageSpy: jest.SpiedFunction<
    typeof window.showInformationMessage
  >;

  beforeEach(() => {
    dir = tmp.dirSync();

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
