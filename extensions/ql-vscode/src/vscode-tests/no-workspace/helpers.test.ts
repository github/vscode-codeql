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
} from "vscode";
import * as yaml from "js-yaml";
import * as tmp from "tmp";
import * as path from "path";
import * as fs from "fs-extra";
import { DirResult } from "tmp";

import {
  getInitialQueryContents,
  InvocationRateLimiter,
  isLikelyDatabaseRoot,
  isLikelyDbLanguageFolder,
  showBinaryChoiceDialog,
  showBinaryChoiceWithUrlDialog,
  showInformationMessageWithAction,
  walkDirectory,
} from "../../helpers";
import { reportStreamProgress } from "../../commandRunner";

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
    beforeEach(() => {
      dir = tmp.dirSync();
      const contents = yaml.dump({
        primaryLanguage: "cpp",
      });
      fs.writeFileSync(
        path.join(dir.name, "codeql-database.yml"),
        contents,
        "utf8",
      );
    });

    afterEach(() => {
      dir.removeCallback();
    });

    it("should get initial query contents when language is known", () => {
      expect(getInitialQueryContents("cpp", "hucairz")).toBe(
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
      const dbFolder = path.join(dir.name, "db");
      fs.mkdirSync(dbFolder);
      fs.mkdirSync(path.join(dbFolder, "db-python"));
      fs.writeFileSync(path.join(dbFolder, "codeql-database.yml"), "", "utf8");

      expect(await isLikelyDatabaseRoot(dbFolder)).toBe(true);
    });

    it("should likely be a database root: .dbinfo", async () => {
      const dbFolder = path.join(dir.name, "db");
      fs.mkdirSync(dbFolder);
      fs.mkdirSync(path.join(dbFolder, "db-python"));
      fs.writeFileSync(path.join(dbFolder, ".dbinfo"), "", "utf8");

      expect(await isLikelyDatabaseRoot(dbFolder)).toBe(true);
    });

    it("should likely NOT be a database root: empty dir", async () => {
      const dbFolder = path.join(dir.name, "db");
      fs.mkdirSync(dbFolder);
      fs.mkdirSync(path.join(dbFolder, "db-python"));

      expect(await isLikelyDatabaseRoot(dbFolder)).toBe(false);
    });

    it("should likely NOT be a database root: no db language folder", async () => {
      const dbFolder = path.join(dir.name, "db");
      fs.mkdirSync(dbFolder);
      fs.writeFileSync(path.join(dbFolder, ".dbinfo"), "", "utf8");

      expect(await isLikelyDatabaseRoot(dbFolder)).toBe(false);
    });

    it("should find likely db language folder", async () => {
      const dbFolder = path.join(dir.name, "db-python");
      fs.mkdirSync(dbFolder);
      fs.mkdirSync(path.join(dbFolder, "db-python"));
      fs.writeFileSync(path.join(dbFolder, "codeql-database.yml"), "", "utf8");

      // not a db folder since there is a db-python folder inside this one
      expect(await isLikelyDbLanguageFolder(dbFolder)).toBe(false);

      const nestedDbPythonFolder = path.join(dbFolder, "db-python");
      expect(await isLikelyDbLanguageFolder(nestedDbPythonFolder)).toBe(true);
    });
  });

  class MockExtensionContext implements ExtensionContext {
    extensionMode: ExtensionMode = 3;
    subscriptions: { dispose(): unknown }[] = [];
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

  describe("open dialog", () => {
    const showInformationMessageSpy = jest.spyOn(
      window,
      "showInformationMessage",
    );

    beforeEach(() => {
      showInformationMessageSpy.mockResolvedValue(undefined);
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
});

describe("walkDirectory", () => {
  let tmpDir: DirResult;
  let dir: string;
  let dir2: string;

  beforeEach(() => {
    tmpDir = tmp.dirSync({ unsafeCleanup: true });
    dir = path.join(tmpDir.name, "dir");
    fs.ensureDirSync(dir);
    dir2 = path.join(tmpDir.name, "dir2");
  });

  afterEach(() => {
    tmpDir.removeCallback();
  });

  it("should walk a directory", async () => {
    const file1 = path.join(dir, "file1");
    const file2 = path.join(dir, "file2");
    const file3 = path.join(dir, "file3");
    const dir3 = path.join(dir, "dir3");
    const file4 = path.join(dir, "file4");
    const file5 = path.join(dir, "file5");
    const file6 = path.join(dir, "file6");

    // These symlinks link back to paths that are already existing, so ignore.
    const symLinkFile7 = path.join(dir, "symlink0");
    const symlinkDir = path.join(dir2, "symlink1");

    // some symlinks that point outside of the base dir.
    const file8 = path.join(tmpDir.name, "file8");
    const file9 = path.join(dir2, "file8");
    const symlinkDir2 = path.join(dir2, "symlink2");
    const symlinkFile2 = path.join(dir2, "symlinkFile3");

    fs.ensureDirSync(dir2);
    fs.ensureDirSync(dir3);

    fs.writeFileSync(file1, "file1");
    fs.writeFileSync(file2, "file2");
    fs.writeFileSync(file3, "file3");
    fs.writeFileSync(file4, "file4");
    fs.writeFileSync(file5, "file5");
    fs.writeFileSync(file6, "file6");
    fs.writeFileSync(file8, "file8");
    fs.writeFileSync(file9, "file9");

    // We don't really need to be testing all of these variants of symlinks,
    // but it doesn't hurt, and will help us if we ever do decide to support them.
    fs.symlinkSync(file6, symLinkFile7, "file");
    fs.symlinkSync(dir3, symlinkDir, "dir");
    fs.symlinkSync(file8, symlinkFile2, "file");
    fs.symlinkSync(dir2, symlinkDir2, "dir");

    const files = [];
    for await (const file of walkDirectory(dir)) {
      files.push(file);
    }

    // Only real files should be returned.
    expect(files.sort()).toEqual([file1, file2, file3, file4, file5, file6]);
  });
});
