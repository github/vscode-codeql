import {
  EnvironmentVariableCollection,
  EnvironmentVariableMutator,
  Event,
  ExtensionContext,
  ExtensionMode,
  Memento,
  SecretStorage,
  SecretStorageChangeEvent,
  Uri,
  window,
  workspace,
  WorkspaceFolder,
} from "vscode";
import { dump } from "js-yaml";
import * as tmp from "tmp";
import { join } from "path";
import { writeFileSync, mkdirSync, writeFile, mkdir } from "fs-extra";

import {
  getFirstWorkspaceFolder,
  getInitialQueryContents,
  InvocationRateLimiter,
  isFolderAlreadyInWorkspace,
  isLikelyDatabaseRoot,
  isLikelyDbLanguageFolder,
  prepareCodeTour,
  showBinaryChoiceDialog,
  showBinaryChoiceWithUrlDialog,
  showInformationMessageWithAction,
  showNeverAskAgainDialog,
} from "../../../src/helpers";
import { reportStreamProgress } from "../../../src/common/vscode/progress";
import { QueryLanguage } from "../../../src/common/query-language";
import { Setting } from "../../../src/config";
import { createMockCommandManager } from "../../__mocks__/commandsMock";

describe("helpers", () => {
  describe("Invocation rate limiter", () => {
    // 1 January 2020
    let currentUnixTime = 1577836800;

    function createDate(dateString?: string): Date {
      if (dateString) {
        return new Date(dateString);
      }
      const numMillisecondsPerSecond = 1000;
      return new Date(currentUnixTime * numMillisecondsPerSecond);
    }

    function createInvocationRateLimiter<T>(
      funcIdentifier: string,
      func: () => Promise<T>,
    ): InvocationRateLimiter<T> {
      return new InvocationRateLimiter(
        new MockExtensionContext(),
        funcIdentifier,
        func,
        (s) => createDate(s),
      );
    }

    it("initially invokes function", async () => {
      let numTimesFuncCalled = 0;
      const invocationRateLimiter = createInvocationRateLimiter(
        "funcid",
        async () => {
          numTimesFuncCalled++;
        },
      );
      await invocationRateLimiter.invokeFunctionIfIntervalElapsed(100);
      expect(numTimesFuncCalled).toBe(1);
    });

    it("doesn't invoke function again if no time has passed", async () => {
      let numTimesFuncCalled = 0;
      const invocationRateLimiter = createInvocationRateLimiter(
        "funcid",
        async () => {
          numTimesFuncCalled++;
        },
      );
      await invocationRateLimiter.invokeFunctionIfIntervalElapsed(100);
      await invocationRateLimiter.invokeFunctionIfIntervalElapsed(100);
      expect(numTimesFuncCalled).toBe(1);
    });

    it("doesn't invoke function again if requested time since last invocation hasn't passed", async () => {
      let numTimesFuncCalled = 0;
      const invocationRateLimiter = createInvocationRateLimiter(
        "funcid",
        async () => {
          numTimesFuncCalled++;
        },
      );
      await invocationRateLimiter.invokeFunctionIfIntervalElapsed(100);
      currentUnixTime += 1;
      await invocationRateLimiter.invokeFunctionIfIntervalElapsed(2);
      expect(numTimesFuncCalled).toBe(1);
    });

    it("invokes function again immediately if requested time since last invocation is 0 seconds", async () => {
      let numTimesFuncCalled = 0;
      const invocationRateLimiter = createInvocationRateLimiter(
        "funcid",
        async () => {
          numTimesFuncCalled++;
        },
      );
      await invocationRateLimiter.invokeFunctionIfIntervalElapsed(0);
      await invocationRateLimiter.invokeFunctionIfIntervalElapsed(0);
      expect(numTimesFuncCalled).toBe(2);
    });

    it("invokes function again after requested time since last invocation has elapsed", async () => {
      let numTimesFuncCalled = 0;
      const invocationRateLimiter = createInvocationRateLimiter(
        "funcid",
        async () => {
          numTimesFuncCalled++;
        },
      );
      await invocationRateLimiter.invokeFunctionIfIntervalElapsed(1);
      currentUnixTime += 1;
      await invocationRateLimiter.invokeFunctionIfIntervalElapsed(1);
      expect(numTimesFuncCalled).toBe(2);
    });

    it("invokes functions with different rate limiters", async () => {
      let numTimesFuncACalled = 0;
      const invocationRateLimiterA = createInvocationRateLimiter(
        "funcid",
        async () => {
          numTimesFuncACalled++;
        },
      );
      let numTimesFuncBCalled = 0;
      const invocationRateLimiterB = createInvocationRateLimiter(
        "funcid",
        async () => {
          numTimesFuncBCalled++;
        },
      );
      await invocationRateLimiterA.invokeFunctionIfIntervalElapsed(100);
      await invocationRateLimiterB.invokeFunctionIfIntervalElapsed(100);
      expect(numTimesFuncACalled).toBe(1);
      expect(numTimesFuncBCalled).toBe(1);
    });
  });

  describe("codeql-database.yml tests", () => {
    let dir: tmp.DirResult;
    let language: QueryLanguage;

    beforeEach(() => {
      dir = tmp.dirSync();
      language = QueryLanguage.Cpp;

      const contents = dump({
        primaryLanguage: language,
      });
      writeFileSync(join(dir.name, "codeql-database.yml"), contents, "utf8");
    });

    afterEach(() => {
      dir.removeCallback();
    });

    it("should get initial query contents when language is known", () => {
      expect(getInitialQueryContents(language, "hucairz")).toBe(
        'import cpp\n\nselect ""',
      );
    });

    it("should get initial query contents when dbscheme is known", () => {
      expect(getInitialQueryContents("", "semmlecode.cpp.dbscheme")).toBe(
        'import cpp\n\nselect ""',
      );
    });

    it("should get initial query contents when nothing is known", () => {
      expect(getInitialQueryContents("", "hucairz")).toBe('select ""');
    });
  });

  describe("likely database tests", () => {
    let dir: tmp.DirResult;
    beforeEach(() => {
      dir = tmp.dirSync();
    });

    afterEach(() => {
      dir.removeCallback();
    });

    it("should likely be a database root: codeql-database.yml", async () => {
      const dbFolder = join(dir.name, "db");
      mkdirSync(dbFolder);
      mkdirSync(join(dbFolder, "db-python"));
      writeFileSync(join(dbFolder, "codeql-database.yml"), "", "utf8");

      expect(await isLikelyDatabaseRoot(dbFolder)).toBe(true);
    });

    it("should likely be a database root: .dbinfo", async () => {
      const dbFolder = join(dir.name, "db");
      mkdirSync(dbFolder);
      mkdirSync(join(dbFolder, "db-python"));
      writeFileSync(join(dbFolder, ".dbinfo"), "", "utf8");

      expect(await isLikelyDatabaseRoot(dbFolder)).toBe(true);
    });

    it("should likely NOT be a database root: empty dir", async () => {
      const dbFolder = join(dir.name, "db");
      mkdirSync(dbFolder);
      mkdirSync(join(dbFolder, "db-python"));

      expect(await isLikelyDatabaseRoot(dbFolder)).toBe(false);
    });

    it("should likely NOT be a database root: no db language folder", async () => {
      const dbFolder = join(dir.name, "db");
      mkdirSync(dbFolder);
      writeFileSync(join(dbFolder, ".dbinfo"), "", "utf8");

      expect(await isLikelyDatabaseRoot(dbFolder)).toBe(false);
    });

    it("should find likely db language folder", async () => {
      const dbFolder = join(dir.name, "db-python");
      mkdirSync(dbFolder);
      mkdirSync(join(dbFolder, "db-python"));
      writeFileSync(join(dbFolder, "codeql-database.yml"), "", "utf8");

      // not a db folder since there is a db-python folder inside this one
      expect(await isLikelyDbLanguageFolder(dbFolder)).toBe(false);

      const nestedDbPythonFolder = join(dbFolder, "db-python");
      expect(await isLikelyDbLanguageFolder(nestedDbPythonFolder)).toBe(true);
    });
  });

  class MockExtensionContext implements ExtensionContext {
    extensionMode: ExtensionMode = 3;
    subscriptions: Array<{ dispose(): unknown }> = [];
    workspaceState: Memento = new MockMemento();
    globalState = new MockGlobalStorage();
    extensionPath = "";
    asAbsolutePath(_relativePath: string): string {
      throw new Error("Method not implemented.");
    }
    storagePath = "";
    globalStoragePath = "";
    logPath = "";
    extensionUri = Uri.parse("");
    environmentVariableCollection = new MockEnvironmentVariableCollection();
    secrets = new MockSecretStorage();
    storageUri = Uri.parse("");
    globalStorageUri = Uri.parse("");
    logUri = Uri.parse("");
    extension: any;
  }

  class MockEnvironmentVariableCollection
    implements EnvironmentVariableCollection
  {
    [Symbol.iterator](): Iterator<
      [variable: string, mutator: EnvironmentVariableMutator],
      any,
      undefined
    > {
      throw new Error("Method not implemented.");
    }
    persistent = false;
    replace(_variable: string, _value: string): void {
      throw new Error("Method not implemented.");
    }
    append(_variable: string, _value: string): void {
      throw new Error("Method not implemented.");
    }
    prepend(_variable: string, _value: string): void {
      throw new Error("Method not implemented.");
    }
    get(_variable: string): EnvironmentVariableMutator | undefined {
      throw new Error("Method not implemented.");
    }
    forEach(
      _callback: (
        variable: string,
        mutator: EnvironmentVariableMutator,
        collection: EnvironmentVariableCollection,
      ) => any,
      _thisArg?: any,
    ): void {
      throw new Error("Method not implemented.");
    }
    delete(_variable: string): void {
      throw new Error("Method not implemented.");
    }
    clear(): void {
      throw new Error("Method not implemented.");
    }
  }

  class MockMemento implements Memento {
    keys(): readonly string[] {
      throw new Error("Method not implemented.");
    }
    map = new Map<any, any>();

    /**
     * Return a value.
     *
     * @param key A string.
     * @param defaultValue A value that should be returned when there is no
     * value (`undefined`) with the given key.
     * @return The stored value or the defaultValue.
     */
    get<T>(key: string, defaultValue?: T): T {
      return this.map.has(key) ? this.map.get(key) : defaultValue;
    }

    /**
     * Store a value. The value must be JSON-stringifyable.
     *
     * @param key A string.
     * @param value A value. MUST not contain cyclic references.
     */
    async update(key: string, value: any): Promise<void> {
      this.map.set(key, value);
    }
  }

  class MockGlobalStorage extends MockMemento {
    public setKeysForSync(_keys: string[]): void {
      return;
    }
  }

  class MockSecretStorage implements SecretStorage {
    get(_key: string): Thenable<string | undefined> {
      throw new Error("Method not implemented.");
    }
    store(_key: string, _value: string): Thenable<void> {
      throw new Error("Method not implemented.");
    }
    delete(_key: string): Thenable<void> {
      throw new Error("Method not implemented.");
    }
    onDidChange!: Event<SecretStorageChangeEvent>;
  }

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
