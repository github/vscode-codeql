import type {
  FileSystemWatcher,
  WorkspaceFolder,
  WorkspaceFoldersChangeEvent,
} from "vscode";
import { EventEmitter, Uri, workspace } from "vscode";
import { FilePathDiscovery } from "../../../../../src/common/vscode/file-path-discovery";
import { basename, dirname, join } from "path";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirSync } from "tmp";
import { normalizePath } from "../../../../../src/common/files";
import { extLogger } from "../../../../../src/common/logging/vscode/loggers";
import { getErrorMessage } from "../../../../../src/common/helpers-pure";

interface TestData {
  path: string;
  contents: string;
}

/**
 * A test FilePathDiscovery that operates on files with the ".test" extension.
 */
class TestFilePathDiscovery extends FilePathDiscovery<TestData> {
  public getDataForPathFunc: ((path: string) => Promise<TestData>) | undefined =
    undefined;

  constructor() {
    super("TestFilePathDiscovery", "**/*.test");
  }

  public get onDidChangePaths() {
    return this.onDidChangePathData;
  }

  public getPathData(): readonly TestData[] | undefined {
    return super.getPathData();
  }

  protected async getDataForPath(path: string): Promise<TestData> {
    if (this.getDataForPathFunc !== undefined) {
      return this.getDataForPathFunc(path);
    }
    return {
      path,
      contents: readFileSync(path, "utf8"),
    };
  }

  protected pathIsRelevant(path: string): boolean {
    return path.endsWith(".test");
  }

  protected shouldOverwriteExistingData(
    newData: TestData,
    existingData: TestData,
  ): boolean {
    return newData.contents !== existingData.contents;
  }
}

describe("FilePathDiscovery", () => {
  let tmpDir: string;
  let tmpDirRemoveCallback: (() => void) | undefined;

  let workspaceFolder: WorkspaceFolder;
  let workspacePath: string;
  let workspaceFoldersSpy: jest.SpiedFunction<
    () => typeof workspace.workspaceFolders
  >;

  const onDidCreateFile = new EventEmitter<Uri>();
  const onDidChangeFile = new EventEmitter<Uri>();
  const onDidDeleteFile = new EventEmitter<Uri>();
  let createFileSystemWatcherSpy: jest.SpiedFunction<
    typeof workspace.createFileSystemWatcher
  >;

  const onDidChangeWorkspaceFolders =
    new EventEmitter<WorkspaceFoldersChangeEvent>();

  let discovery: TestFilePathDiscovery;

  beforeEach(() => {
    const t = dirSync({
      unsafeCleanup: true,
    });
    tmpDir = normalizePath(t.name);
    tmpDirRemoveCallback = t.removeCallback;

    workspaceFolder = {
      uri: Uri.file(join(tmpDir, "workspace")),
      name: "test",
      index: 0,
    };
    workspacePath = workspaceFolder.uri.fsPath;
    workspaceFoldersSpy = jest
      .spyOn(workspace, "workspaceFolders", "get")
      .mockReturnValue([workspaceFolder]);

    const watcher: FileSystemWatcher = {
      ignoreCreateEvents: false,
      ignoreChangeEvents: false,
      ignoreDeleteEvents: false,
      onDidCreate: onDidCreateFile.event,
      onDidChange: onDidChangeFile.event,
      onDidDelete: onDidDeleteFile.event,
      dispose: () => undefined,
    };
    createFileSystemWatcherSpy = jest
      .spyOn(workspace, "createFileSystemWatcher")
      .mockReturnValue(watcher);

    jest
      .spyOn(workspace, "onDidChangeWorkspaceFolders")
      .mockImplementation(onDidChangeWorkspaceFolders.event);

    discovery = new TestFilePathDiscovery();
  });

  afterEach(() => {
    tmpDirRemoveCallback?.();
    discovery.dispose();
  });

  describe("initialRefresh", () => {
    it("should return undefined until initialRefresh is called", async () => {
      expect(discovery.getPathData()).toEqual(undefined);
    });

    it("should handle no files being present", async () => {
      await discovery.initialRefresh();
      expect(discovery.getPathData()).toEqual([]);
    });

    it("should recursively discover all test files", async () => {
      makeTestFile(join(workspacePath, "123.test"));
      makeTestFile(join(workspacePath, "456.test"));
      makeTestFile(join(workspacePath, "bar", "789.test"));

      await discovery.initialRefresh();

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([
          { path: join(workspacePath, "123.test"), contents: "123" },
          { path: join(workspacePath, "456.test"), contents: "456" },
          { path: join(workspacePath, "bar", "789.test"), contents: "789" },
        ]),
      );
    });

    it("should ignore non-test files", async () => {
      makeTestFile(join(workspacePath, "1.test"));
      makeTestFile(join(workspacePath, "2.foo"));
      makeTestFile(join(workspacePath, "bar.ql"));

      await discovery.initialRefresh();

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([{ path: join(workspacePath, "1.test"), contents: "1" }]),
      );
    });

    it("should trigger listener when paths are found", async () => {
      makeTestFile(join(workspacePath, "123.test"));

      const didChangePathsListener = jest.fn();
      discovery.onDidChangePaths(didChangePathsListener);

      await discovery.initialRefresh();

      expect(didChangePathsListener).toHaveBeenCalled();
    });

    it("should trigger listener when no paths are found", async () => {
      const didChangePathsListener = jest.fn();
      discovery.onDidChangePaths(didChangePathsListener);

      await discovery.initialRefresh();

      expect(didChangePathsListener).toHaveBeenCalled();
    });
  });

  describe("file added", () => {
    it("should discover a single new file", async () => {
      await discovery.initialRefresh();

      const didChangePathsListener = jest.fn();
      discovery.onDidChangePaths(didChangePathsListener);

      expect(discovery.getPathData()).toEqual([]);

      const newFile = join(workspacePath, "1.test");
      makeTestFile(newFile);
      onDidCreateFile.fire(Uri.file(newFile));
      await discovery.waitForCurrentRefresh();

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([{ path: join(workspacePath, "1.test"), contents: "1" }]),
      );
      expect(didChangePathsListener).toHaveBeenCalled();
    });

    it("should do nothing if file doesnt actually exist", async () => {
      await discovery.initialRefresh();

      const didChangePathsListener = jest.fn();
      discovery.onDidChangePaths(didChangePathsListener);

      expect(discovery.getPathData()).toEqual([]);

      onDidCreateFile.fire(Uri.file(join(workspacePath, "1.test")));
      await discovery.waitForCurrentRefresh();

      expect(discovery.getPathData()).toEqual([]);
      expect(didChangePathsListener).not.toHaveBeenCalled();
    });

    it("should recursively discover a directory of new files", async () => {
      await discovery.initialRefresh();

      const didChangePathsListener = jest.fn();
      discovery.onDidChangePaths(didChangePathsListener);

      expect(discovery.getPathData()).toEqual([]);

      const newDir = join(workspacePath, "foo");
      makeTestFile(join(newDir, "1.test"));
      makeTestFile(join(newDir, "bar", "2.test"));
      makeTestFile(join(newDir, "bar", "3.test"));
      onDidCreateFile.fire(Uri.file(newDir));
      await discovery.waitForCurrentRefresh();

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([
          { path: join(newDir, "1.test"), contents: "1" },
          { path: join(newDir, "bar", "2.test"), contents: "2" },
          { path: join(newDir, "bar", "3.test"), contents: "3" },
        ]),
      );
      expect(didChangePathsListener).toHaveBeenCalled();
    });

    it("should do nothing if file is already known", async () => {
      const testFile = join(workspacePath, "1.test");
      makeTestFile(testFile);

      await discovery.initialRefresh();

      const didChangePathsListener = jest.fn();
      discovery.onDidChangePaths(didChangePathsListener);

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([{ path: join(workspacePath, "1.test"), contents: "1" }]),
      );

      onDidCreateFile.fire(Uri.file(testFile));
      await discovery.waitForCurrentRefresh();

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([{ path: join(workspacePath, "1.test"), contents: "1" }]),
      );
      expect(didChangePathsListener).not.toHaveBeenCalled();
    });
  });

  describe("file changed", () => {
    it("should do nothing if nothing has actually changed", async () => {
      const testFile = join(workspacePath, "123.test");
      makeTestFile(testFile);

      await discovery.initialRefresh();

      const didChangePathsListener = jest.fn();
      discovery.onDidChangePaths(didChangePathsListener);

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([{ path: join(workspacePath, "123.test"), contents: "123" }]),
      );

      onDidChangeFile.fire(Uri.file(testFile));
      await discovery.waitForCurrentRefresh();

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([{ path: join(workspacePath, "123.test"), contents: "123" }]),
      );
      expect(didChangePathsListener).not.toHaveBeenCalled();
    });

    it("should update data if it has changed", async () => {
      const testFile = join(workspacePath, "1.test");
      makeTestFile(testFile, "foo");

      await discovery.initialRefresh();

      const didChangePathsListener = jest.fn();
      discovery.onDidChangePaths(didChangePathsListener);

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([{ path: join(workspacePath, "1.test"), contents: "foo" }]),
      );

      writeFileSync(testFile, "bar");
      onDidChangeFile.fire(Uri.file(testFile));
      await discovery.waitForCurrentRefresh();

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([{ path: join(workspacePath, "1.test"), contents: "bar" }]),
      );
      expect(didChangePathsListener).toHaveBeenCalled();
    });
  });

  describe("file deleted", () => {
    it("should remove a file that has been deleted", async () => {
      const testFile = join(workspacePath, "1.test");
      makeTestFile(testFile);

      await discovery.initialRefresh();

      const didChangePathsListener = jest.fn();
      discovery.onDidChangePaths(didChangePathsListener);

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([{ path: join(workspacePath, "1.test"), contents: "1" }]),
      );

      rmSync(testFile);
      onDidDeleteFile.fire(Uri.file(testFile));
      await discovery.waitForCurrentRefresh();

      expect(discovery.getPathData()).toEqual([]);
      expect(didChangePathsListener).toHaveBeenCalled();
    });

    it("should do nothing if file still exists", async () => {
      const testFile = join(workspacePath, "1.test");
      makeTestFile(testFile);

      await discovery.initialRefresh();

      const didChangePathsListener = jest.fn();
      discovery.onDidChangePaths(didChangePathsListener);

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([{ path: join(workspacePath, "1.test"), contents: "1" }]),
      );

      onDidDeleteFile.fire(Uri.file(testFile));
      await discovery.waitForCurrentRefresh();

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([{ path: join(workspacePath, "1.test"), contents: "1" }]),
      );
      expect(didChangePathsListener).not.toHaveBeenCalled();
    });

    it("should remove a directory of files that has been deleted", async () => {
      makeTestFile(join(workspacePath, "123.test"));
      makeTestFile(join(workspacePath, "bar", "456.test"));
      makeTestFile(join(workspacePath, "bar", "789.test"));

      await discovery.initialRefresh();

      const didChangePathsListener = jest.fn();
      discovery.onDidChangePaths(didChangePathsListener);

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([
          { path: join(workspacePath, "123.test"), contents: "123" },
          { path: join(workspacePath, "bar", "456.test"), contents: "456" },
          { path: join(workspacePath, "bar", "789.test"), contents: "789" },
        ]),
      );

      rmSync(join(workspacePath, "bar"), { recursive: true });

      onDidDeleteFile.fire(Uri.file(join(workspacePath, "bar")));
      await discovery.waitForCurrentRefresh();

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([{ path: join(workspacePath, "123.test"), contents: "123" }]),
      );
      expect(didChangePathsListener).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle errors and still process other files", async () => {
      await discovery.initialRefresh();

      discovery.getDataForPathFunc = async (path: string) => {
        if (basename(path) === "123.test") {
          throw new Error("error");
        } else {
          return { path, contents: readFileSync(path, "utf8") };
        }
      };
      const logSpy = jest.spyOn(extLogger, "log");

      makeTestFile(join(workspacePath, "123.test"));
      makeTestFile(join(workspacePath, "456.test"));

      onDidCreateFile.fire(Uri.file(join(workspacePath, "123.test")));
      onDidCreateFile.fire(Uri.file(join(workspacePath, "456.test")));
      await discovery.waitForCurrentRefresh();

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([{ path: join(workspacePath, "456.test"), contents: "456" }]),
      );

      expect(logSpy).toHaveBeenCalledWith(
        `TestFilePathDiscovery failed while processing path "${join(
          workspacePath,
          "123.test",
        )}": ${getErrorMessage(new Error("error"))}`,
      );
    });
  });

  describe("workspaceFoldersChanged", () => {
    it("initialRefresh establishes watchers", async () => {
      await discovery.initialRefresh();

      // Called twice for each workspace folder
      expect(createFileSystemWatcherSpy).toHaveBeenCalledTimes(2);
    });

    it("should install watchers when workspace folders change", async () => {
      await discovery.initialRefresh();

      createFileSystemWatcherSpy.mockClear();

      const previousWorkspaceFolders = workspace.workspaceFolders || [];
      const newWorkspaceFolders: WorkspaceFolder[] = [
        {
          uri: Uri.file(join(tmpDir, "workspace2")),
          name: "workspace2",
          index: 0,
        },
        {
          uri: Uri.file(join(tmpDir, "workspace3")),
          name: "workspace3",
          index: 1,
        },
      ];
      workspaceFoldersSpy.mockReturnValue(newWorkspaceFolders);

      onDidChangeWorkspaceFolders.fire({
        added: newWorkspaceFolders,
        removed: previousWorkspaceFolders,
      });
      await discovery.waitForCurrentRefresh();

      // Called twice for each workspace folder
      expect(createFileSystemWatcherSpy).toHaveBeenCalledTimes(4);
    });

    it("should discover files in new workspaces", async () => {
      makeTestFile(join(workspacePath, "123.test"));

      await discovery.initialRefresh();

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([{ path: join(workspacePath, "123.test"), contents: "123" }]),
      );

      const previousWorkspaceFolders = workspace.workspaceFolders || [];
      const newWorkspaceFolders: WorkspaceFolder[] = [
        workspaceFolder,
        {
          uri: Uri.file(join(tmpDir, "workspace2")),
          name: "workspace2",
          index: 1,
        },
      ];
      workspaceFoldersSpy.mockReturnValue(newWorkspaceFolders);

      makeTestFile(join(tmpDir, "workspace2", "456.test"));

      onDidChangeWorkspaceFolders.fire({
        added: newWorkspaceFolders,
        removed: previousWorkspaceFolders,
      });
      await discovery.waitForCurrentRefresh();

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([
          { path: join(workspacePath, "123.test"), contents: "123" },
          { path: join(tmpDir, "workspace2", "456.test"), contents: "456" },
        ]),
      );
    });

    it("should forgot files in old workspaces, even if the files on disk still exist", async () => {
      const workspaceFolders: WorkspaceFolder[] = [
        {
          uri: Uri.file(join(tmpDir, "workspace1")),
          name: "workspace1",
          index: 0,
        },
        {
          uri: Uri.file(join(tmpDir, "workspace2")),
          name: "workspace2",
          index: 1,
        },
      ];
      workspaceFoldersSpy.mockReturnValue(workspaceFolders);

      makeTestFile(join(tmpDir, "workspace1", "123.test"));
      makeTestFile(join(tmpDir, "workspace2", "456.test"));

      await discovery.initialRefresh();

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([
          { path: join(tmpDir, "workspace1", "123.test"), contents: "123" },
          { path: join(tmpDir, "workspace2", "456.test"), contents: "456" },
        ]),
      );

      workspaceFoldersSpy.mockReturnValue([workspaceFolders[0]]);
      onDidChangeWorkspaceFolders.fire({
        added: [],
        removed: [workspaceFolders[1]],
      });
      await discovery.waitForCurrentRefresh();

      expect(new Set(discovery.getPathData())).toEqual(
        new Set([
          { path: join(tmpDir, "workspace1", "123.test"), contents: "123" },
        ]),
      );
    });
  });
});

function makeTestFile(path: string, contents?: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents ?? basename(path, ".test"));
}
