import { Uri, window, workspace, WorkspaceFolder } from "vscode";
import * as tmp from "tmp";
import { join } from "path";
import { writeFile, mkdir } from "fs-extra";

import {
  getFirstWorkspaceFolder,
  isFolderAlreadyInWorkspace,
  prepareCodeTour,
  showBinaryChoiceDialog,
  showBinaryChoiceWithUrlDialog,
  showInformationMessageWithAction,
  showNeverAskAgainDialog,
} from "../../../src/helpers";
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

  describe("showBinaryChoiceDialog", () => {
    let showInformationMessageSpy: jest.SpiedFunction<
      typeof window.showInformationMessage
    >;

    beforeEach(() => {
      showInformationMessageSpy = jest
        .spyOn(window, "showInformationMessage")
        .mockResolvedValue(undefined);
    });

    const resolveArg =
      (index: number) =>
      (...args: any[]) =>
        Promise.resolve(args[index]);

    it("should show a binary choice dialog and return `yes`", async () => {
      // pretend user chooses 'yes'
      showInformationMessageSpy.mockImplementationOnce(resolveArg(2));
      const val = await showBinaryChoiceDialog("xxx");
      expect(val).toBe(true);
    });

    it("should show a binary choice dialog and return `no`", async () => {
      // pretend user chooses 'no'
      showInformationMessageSpy.mockImplementationOnce(resolveArg(3));
      const val = await showBinaryChoiceDialog("xxx");
      expect(val).toBe(false);
    });
  });

  describe("showInformationMessageWithAction", () => {
    let showInformationMessageSpy: jest.SpiedFunction<
      typeof window.showInformationMessage
    >;

    beforeEach(() => {
      showInformationMessageSpy = jest
        .spyOn(window, "showInformationMessage")
        .mockResolvedValue(undefined);
    });

    const resolveArg =
      (index: number) =>
      (...args: any[]) =>
        Promise.resolve(args[index]);

    it("should show an info dialog and confirm the action", async () => {
      // pretend user chooses to run action
      showInformationMessageSpy.mockImplementationOnce(resolveArg(1));
      const val = await showInformationMessageWithAction("xxx", "yyy");
      expect(val).toBe(true);
    });

    it("should show an action dialog and avoid choosing the action", async () => {
      // pretend user does not choose to run action
      showInformationMessageSpy.mockResolvedValueOnce(undefined);
      const val = await showInformationMessageWithAction("xxx", "yyy");
      expect(val).toBe(false);
    });
  });

  describe("showBinaryChoiceWithUrlDialog", () => {
    let showInformationMessageSpy: jest.SpiedFunction<
      typeof window.showInformationMessage
    >;

    beforeEach(() => {
      showInformationMessageSpy = jest
        .spyOn(window, "showInformationMessage")
        .mockResolvedValue(undefined);
    });

    const resolveArg =
      (index: number) =>
      (...args: any[]) =>
        Promise.resolve(args[index]);

    it("should show a binary choice dialog with a url and return `yes`", async () => {
      // pretend user clicks on the url twice and then clicks 'yes'
      showInformationMessageSpy
        .mockImplementation(resolveArg(2))
        .mockImplementation(resolveArg(2))
        .mockImplementation(resolveArg(3));
      const val = await showBinaryChoiceWithUrlDialog("xxx", "invalid:url");
      expect(val).toBe(true);
    });

    it("should show a binary choice dialog with a url and return `no`", async () => {
      // pretend user clicks on the url twice and then clicks 'no'
      showInformationMessageSpy
        .mockImplementation(resolveArg(2))
        .mockImplementation(resolveArg(2))
        .mockImplementation(resolveArg(4));
      const val = await showBinaryChoiceWithUrlDialog("xxx", "invalid:url");
      expect(val).toBe(false);
    });

    it("should show a binary choice dialog and exit after clcking `more info` 5 times", async () => {
      // pretend user clicks on the url twice and then clicks 'no'
      showInformationMessageSpy
        .mockImplementation(resolveArg(2))
        .mockImplementation(resolveArg(2))
        .mockImplementation(resolveArg(2))
        .mockImplementation(resolveArg(2))
        .mockImplementation(resolveArg(2));
      const val = await showBinaryChoiceWithUrlDialog("xxx", "invalid:url");
      // No choice was made
      expect(val).toBeUndefined();
      expect(showInformationMessageSpy).toHaveBeenCalledTimes(5);
    });
  });

  describe("showNeverAskAgainDialog", () => {
    let showInformationMessageSpy: jest.SpiedFunction<
      typeof window.showInformationMessage
    >;

    beforeEach(() => {
      showInformationMessageSpy = jest
        .spyOn(window, "showInformationMessage")
        .mockResolvedValue(undefined);
    });

    const resolveArg =
      (index: number) =>
      (...args: any[]) =>
        Promise.resolve(args[index]);

    const title =
      "We've noticed you don't have a CodeQL pack available to analyze this database. Can we set up a query pack for you?";

    it("should show a ternary choice dialog and return `Yes`", async () => {
      // pretend user chooses 'Yes'
      const yesItem = resolveArg(2);
      showInformationMessageSpy.mockImplementationOnce(yesItem);

      const answer = await showNeverAskAgainDialog(title);
      expect(answer).toBe("Yes");
    });

    it("should show a ternary choice dialog and return `No`", async () => {
      // pretend user chooses 'No'
      const noItem = resolveArg(3);
      showInformationMessageSpy.mockImplementationOnce(noItem);

      const answer = await showNeverAskAgainDialog(title);
      expect(answer).toBe("No");
    });

    it("should show a ternary choice dialog and return `No, and never ask me again`", async () => {
      // pretend user chooses 'No, and never ask me again'
      const neverAskAgainItem = resolveArg(4);
      showInformationMessageSpy.mockImplementationOnce(neverAskAgainItem);

      const answer = await showNeverAskAgainDialog(title);
      expect(answer).toBe("No, and never ask me again");
    });
  });
});

describe("isFolderAlreadyInWorkspace", () => {
  beforeEach(() => {
    const folders = [
      { name: "/first/path" },
      { name: "/second/path" },
    ] as WorkspaceFolder[];

    jest.spyOn(workspace, "workspaceFolders", "get").mockReturnValue(folders);
  });
  it("should return true if the folder is already in the workspace", () => {
    expect(isFolderAlreadyInWorkspace("/first/path")).toBe(true);
  });

  it("should return false if the folder is not in the workspace", () => {
    expect(isFolderAlreadyInWorkspace("/third/path")).toBe(false);
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

describe("getFirstWorkspaceFolder", () => {
  it("should return the first workspace folder", async () => {
    jest.spyOn(workspace, "workspaceFolders", "get").mockReturnValue([
      {
        name: "codespaces-codeql",
        uri: { fsPath: "codespaces-codeql", scheme: "file" },
      },
    ] as WorkspaceFolder[]);

    expect(getFirstWorkspaceFolder()).toEqual("codespaces-codeql");
  });

  describe("if user is in vscode-codeql-starter workspace", () => {
    it("should set storage path to parent folder", async () => {
      jest.spyOn(workspace, "workspaceFolders", "get").mockReturnValue([
        {
          name: "codeql-custom-queries-cpp",
          uri: {
            fsPath: join("vscode-codeql-starter", "codeql-custom-queries-cpp"),
            scheme: "file",
          },
        },
        {
          name: "codeql-custom-queries-csharp",
          uri: {
            fsPath: join(
              "vscode-codeql-starter",
              "codeql-custom-queries-csharp",
            ),
            scheme: "file",
          },
        },
      ] as WorkspaceFolder[]);

      expect(getFirstWorkspaceFolder()).toEqual("vscode-codeql-starter");
    });
  });
});
