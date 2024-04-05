import type { WorkspaceFolder } from "vscode";
import { Uri, workspace } from "vscode";
import type { DirectoryResult } from "tmp-promise";
import { dir } from "tmp-promise";
import { join } from "path";
import {
  ensurePackLocationIsInWorkspaceFolder,
  getRootWorkspaceDirectory,
  packLocationToAbsolute,
} from "../../../../src/model-editor/extensions-workspace-folder";
import * as files from "../../../../src/common/files";
import { mkdirp } from "fs-extra";
import type { NotificationLogger } from "../../../../src/common/logging";
import { createMockLogger } from "../../../__mocks__/loggerMock";
import { mockedObject } from "../../../mocked-object";
import type { ModelConfig } from "../../../../src/config";

describe("getRootWorkspaceDirectory", () => {
  let tmpDir: DirectoryResult;
  let rootDirectory: Uri;

  let workspaceFoldersSpy: jest.SpyInstance<
    readonly WorkspaceFolder[] | undefined,
    []
  >;
  let workspaceFileSpy: jest.SpyInstance<Uri | undefined, []>;
  let mockedTmpDirUri: Uri;

  beforeEach(async () => {
    tmpDir = await dir({
      unsafeCleanup: true,
    });

    rootDirectory = Uri.joinPath(Uri.file(tmpDir.path), "root");

    const mockedTmpDir = join(tmpDir.path, ".tmp", "tmp");
    mockedTmpDirUri = Uri.file(mockedTmpDir);

    workspaceFoldersSpy = jest
      .spyOn(workspace, "workspaceFolders", "get")
      .mockReturnValue([]);
    workspaceFileSpy = jest
      .spyOn(workspace, "workspaceFile", "get")
      .mockReturnValue(undefined);

    jest.spyOn(files, "tmpdir").mockReturnValue(mockedTmpDir);
  });

  afterEach(async () => {
    await tmpDir.cleanup();
  });

  it("when a workspace file exists", async () => {
    workspaceFoldersSpy.mockReturnValue([
      {
        uri: Uri.file("/a/b/c"),
        name: "codeql-custom-queries-java",
        index: 0,
      },
      {
        uri: Uri.joinPath(rootDirectory, "codeql-custom-queries-python"),
        name: "codeql-custom-queries-python",
        index: 1,
      },
    ]);

    workspaceFileSpy.mockReturnValue(
      Uri.joinPath(rootDirectory, "workspace.code-workspace"),
    );

    expect(await getRootWorkspaceDirectory()).toEqual(rootDirectory);
  });

  it("when a workspace file does not exist and there is a common root directory", async () => {
    workspaceFoldersSpy.mockReturnValue([
      {
        uri: Uri.joinPath(rootDirectory, "codeql-custom-queries-java"),
        name: "codeql-custom-queries-java",
        index: 0,
      },
      {
        uri: Uri.joinPath(rootDirectory, "codeql-custom-queries-python"),
        name: "codeql-custom-queries-python",
        index: 1,
      },
    ]);

    expect((await getRootWorkspaceDirectory())?.fsPath).toEqual(
      rootDirectory.fsPath,
    );
  });

  it("when a workspace file does not exist and there is a temp dir as workspace folder", async () => {
    workspaceFoldersSpy.mockReturnValue([
      {
        uri: Uri.joinPath(rootDirectory, "codeql-custom-queries-java"),
        name: "codeql-custom-queries-java",
        index: 0,
      },
      {
        uri: Uri.joinPath(rootDirectory, "codeql-custom-queries-python"),
        name: "codeql-custom-queries-python",
        index: 1,
      },
      {
        uri: Uri.joinPath(mockedTmpDirUri, "quick-queries"),
        name: "quick-queries",
        index: 2,
      },
    ]);

    expect((await getRootWorkspaceDirectory())?.fsPath).toEqual(
      rootDirectory.fsPath,
    );
  });

  it("when a workspace file does not exist and there is no common root directory", async () => {
    workspaceFoldersSpy.mockReturnValue([
      {
        uri: Uri.joinPath(rootDirectory, "codeql-custom-queries-java"),
        name: "codeql-custom-queries-java",
        index: 0,
      },
      {
        uri: Uri.file("/a/b/c"),
        name: "codeql-custom-queries-python",
        index: 1,
      },
    ]);

    expect(await getRootWorkspaceDirectory()).toBeUndefined();
  });

  it("when a workspace file does not exist and there is a .git folder", async () => {
    await mkdirp(join(rootDirectory.fsPath, ".git"));

    workspaceFoldersSpy.mockReturnValue([
      {
        uri: Uri.joinPath(rootDirectory, "codeql-custom-queries-java"),
        name: "codeql-custom-queries-java",
        index: 0,
      },
      {
        uri: Uri.file("/a/b/c"),
        name: "codeql-custom-queries-python",
        index: 1,
      },
    ]);

    expect(await getRootWorkspaceDirectory()).toEqual(rootDirectory);
  });

  it("when there is no on-disk workspace folder", async () => {
    workspaceFoldersSpy.mockReturnValue([
      {
        uri: Uri.parse("codeql-zip-archive://codeql_db"),
        name: "my-db",
        index: 0,
      },
    ]);

    expect(await getRootWorkspaceDirectory()).toBeUndefined();
  });
});

describe("packLocationToAbsolute", () => {
  let tmpDir: DirectoryResult;
  let rootDirectory: Uri;
  let extensionsDirectory: Uri;

  let logger: NotificationLogger;

  beforeEach(async () => {
    tmpDir = await dir({
      unsafeCleanup: true,
    });

    rootDirectory = Uri.joinPath(Uri.file(tmpDir.path), "root");
    extensionsDirectory = Uri.joinPath(
      rootDirectory,
      ".github",
      "codeql",
      "extensions",
    );

    const mockedTmpDir = join(tmpDir.path, ".tmp", "tmp");

    jest.spyOn(workspace, "workspaceFolders", "get").mockReturnValue([]);
    jest
      .spyOn(workspace, "workspaceFile", "get")
      .mockReturnValue(Uri.joinPath(rootDirectory, "workspace.code-workspace"));

    jest.spyOn(files, "tmpdir").mockReturnValue(mockedTmpDir);

    logger = createMockLogger();
  });

  afterEach(async () => {
    await tmpDir.cleanup();
  });

  it("when the location is absolute", async () => {
    expect(
      await packLocationToAbsolute(extensionsDirectory.fsPath, logger),
    ).toEqual(extensionsDirectory.fsPath);
  });

  it("when the location is relative", async () => {
    expect(
      await packLocationToAbsolute(".github/codeql/extensions/my-pack", logger),
    ).toEqual(Uri.joinPath(extensionsDirectory, "my-pack").fsPath);
  });

  it("when the location is invalid", async () => {
    expect(
      await packLocationToAbsolute("../".repeat(100), logger),
    ).toBeUndefined();
  });
});

describe("ensurePackLocationIsInWorkspaceFolder", () => {
  let tmpDir: DirectoryResult;
  let rootDirectory: Uri;
  let extensionsDirectory: Uri;
  let packLocation: string;

  let workspaceFoldersSpy: jest.SpyInstance<
    readonly WorkspaceFolder[] | undefined,
    []
  >;
  let workspaceFileSpy: jest.SpyInstance<Uri | undefined, []>;
  let updateWorkspaceFoldersSpy: jest.SpiedFunction<
    typeof workspace.updateWorkspaceFolders
  >;

  let getPackLocation: jest.MockedFunction<ModelConfig["getPackLocation"]>;
  let modelConfig: ModelConfig;
  let logger: NotificationLogger;

  beforeEach(async () => {
    tmpDir = await dir({
      unsafeCleanup: true,
    });

    rootDirectory = Uri.joinPath(Uri.file(tmpDir.path), "root");
    extensionsDirectory = Uri.joinPath(
      rootDirectory,
      ".github",
      "codeql",
      "extensions",
    );
    packLocation = Uri.joinPath(extensionsDirectory, "my-pack").fsPath;

    workspaceFoldersSpy = jest
      .spyOn(workspace, "workspaceFolders", "get")
      .mockReturnValue([
        {
          uri: Uri.joinPath(rootDirectory, "codeql-custom-queries-java"),
          name: "codeql-custom-queries-java",
          index: 0,
        },
        {
          uri: Uri.joinPath(rootDirectory, "codeql-custom-queries-python"),
          name: "codeql-custom-queries-python",
          index: 1,
        },
      ]);
    workspaceFileSpy = jest
      .spyOn(workspace, "workspaceFile", "get")
      .mockReturnValue(Uri.joinPath(rootDirectory, "workspace.code-workspace"));
    updateWorkspaceFoldersSpy = jest
      .spyOn(workspace, "updateWorkspaceFolders")
      .mockReturnValue(true);

    logger = createMockLogger();

    getPackLocation = jest
      .fn()
      .mockImplementation(
        (language, { name }) =>
          Uri.joinPath(extensionsDirectory, `${name}-${language}`).fsPath,
      );
    modelConfig = mockedObject<ModelConfig>({
      getPackLocation,
    });
  });

  afterEach(async () => {
    await tmpDir.cleanup();
  });

  it("when there is no workspace file", async () => {
    workspaceFileSpy.mockReturnValue(undefined);

    await ensurePackLocationIsInWorkspaceFolder(
      packLocation,
      modelConfig,
      logger,
    );
    expect(updateWorkspaceFoldersSpy).not.toHaveBeenCalled();
  });

  it("when a workspace folder with the correct path exists", async () => {
    workspaceFoldersSpy.mockReturnValue([
      {
        uri: Uri.joinPath(rootDirectory, "codeql-custom-queries-java"),
        name: "codeql-custom-queries-java",
        index: 0,
      },
      {
        uri: Uri.joinPath(rootDirectory, "codeql-custom-queries-python"),
        name: "codeql-custom-queries-python",
        index: 1,
      },
      {
        uri: extensionsDirectory,
        name: "CodeQL Extension Packs",
        index: 2,
      },
    ]);

    await ensurePackLocationIsInWorkspaceFolder(
      packLocation,
      modelConfig,
      logger,
    );
    expect(updateWorkspaceFoldersSpy).not.toHaveBeenCalled();
  });

  it("when a workspace folder with the correct path does not exist in an unsaved workspace", async () => {
    workspaceFileSpy.mockReturnValue(Uri.parse("untitled:1555503116870"));
    workspaceFoldersSpy.mockReturnValue([
      {
        uri: Uri.file("/a/b/c"),
        name: "codeql-custom-queries-java",
        index: 0,
      },
      {
        uri: Uri.joinPath(rootDirectory, "codeql-custom-queries-python"),
        name: "codeql-custom-queries-python",
        index: 1,
      },
    ]);

    await ensurePackLocationIsInWorkspaceFolder(
      packLocation,
      modelConfig,
      logger,
    );
    expect(updateWorkspaceFoldersSpy).toHaveBeenLastCalledWith(2, 0, {
      name: "CodeQL Extension Packs",
      uri: expect.any(Uri),
    });
    expect(updateWorkspaceFoldersSpy.mock.lastCall?.[2].uri.fsPath).toEqual(
      extensionsDirectory.fsPath,
    );
  });

  it("when a workspace folder with the correct path does not exist in a saved workspace", async () => {
    workspaceFoldersSpy.mockReturnValue([
      {
        uri: Uri.file("/a/b/c"),
        name: "codeql-custom-queries-java",
        index: 0,
      },
      {
        uri: Uri.joinPath(rootDirectory, "codeql-custom-queries-python"),
        name: "codeql-custom-queries-python",
        index: 1,
      },
    ]);

    await ensurePackLocationIsInWorkspaceFolder(
      packLocation,
      modelConfig,
      logger,
    );
    expect(updateWorkspaceFoldersSpy).toHaveBeenLastCalledWith(2, 0, {
      name: "CodeQL Extension Packs",
      uri: expect.any(Uri),
    });
    expect(updateWorkspaceFoldersSpy.mock.lastCall?.[2].uri.fsPath).toEqual(
      extensionsDirectory.fsPath,
    );
  });

  it("when all other pack locations are invalid", async () => {
    getPackLocation.mockReturnValue("/");

    await ensurePackLocationIsInWorkspaceFolder(
      packLocation,
      modelConfig,
      logger,
    );

    expect(updateWorkspaceFoldersSpy).not.toHaveBeenCalled();
  });

  it("when there is no common root directory", async () => {
    getPackLocation.mockImplementation(
      (language, { name }) => `/${name}-${language}`,
    );

    await ensurePackLocationIsInWorkspaceFolder(
      packLocation,
      modelConfig,
      logger,
    );

    expect(updateWorkspaceFoldersSpy).not.toHaveBeenCalled();
  });

  it("when updating the workspace folders fails", async () => {
    updateWorkspaceFoldersSpy.mockReturnValue(false);

    await ensurePackLocationIsInWorkspaceFolder(
      packLocation,
      modelConfig,
      logger,
    );

    expect(logger.log).toHaveBeenCalledWith(
      `Failed to add workspace folder for extensions at ${extensionsDirectory.fsPath}`,
    );
  });
});
