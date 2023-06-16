import {
  CancellationTokenSource,
  QuickPickItem,
  Uri,
  window,
  workspace,
  WorkspaceFolder,
} from "vscode";
import { dump as dumpYaml, load as loadYaml } from "js-yaml";
import { outputFile, readFile } from "fs-extra";
import { join } from "path";
import { dir } from "tmp-promise";
import {
  QlpacksInfo,
  ResolveExtensionsResult,
} from "../../../../src/codeql-cli/cli";

import * as config from "../../../../src/config";

import { pickExtensionPackModelFile } from "../../../../src/data-extensions-editor/extension-pack-picker";
import { ExtensionPack } from "../../../../src/data-extensions-editor/shared/extension-pack";
import { createMockLogger } from "../../../__mocks__/loggerMock";

describe("pickExtensionPackModelFile", () => {
  let tmpDir: string;
  let extensionPackPath: string;
  let anotherExtensionPackPath: string;
  let autoExtensionPackPath: string;
  let extensionPack: ExtensionPack;
  let anotherExtensionPack: ExtensionPack;
  let autoExtensionPack: ExtensionPack;

  let qlPacks: QlpacksInfo;
  let extensions: ResolveExtensionsResult;
  const databaseItem = {
    name: "github/vscode-codeql",
    language: "java",
  };

  const cancellationTokenSource = new CancellationTokenSource();
  const token = cancellationTokenSource.token;

  const progress = jest.fn();
  let showQuickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;
  let showInputBoxSpy: jest.SpiedFunction<typeof window.showInputBox>;
  let disableAutoNameExtensionPackSpy: jest.SpiedFunction<
    typeof config.disableAutoNameExtensionPack
  >;
  let workspaceFoldersSpy: jest.SpyInstance;
  let additionalPacks: string[];
  let workspaceFolder: WorkspaceFolder;

  const logger = createMockLogger();

  beforeEach(async () => {
    tmpDir = (
      await dir({
        unsafeCleanup: true,
      })
    ).path;

    extensionPackPath = join(tmpDir, "my-extension-pack");
    anotherExtensionPackPath = join(tmpDir, "another-extension-pack");
    autoExtensionPackPath = join(tmpDir, "vscode-codeql-java");

    qlPacks = {
      "my-extension-pack": [extensionPackPath],
      "another-extension-pack": [anotherExtensionPackPath],
      "github/vscode-codeql-java": [autoExtensionPackPath],
    };
    extensions = {
      models: [],
      data: {
        [extensionPackPath]: [
          {
            file: join(extensionPackPath, "models", "model.yml"),
            index: 0,
            predicate: "sinkModel",
          },
        ],
        [autoExtensionPackPath]: [
          {
            file: join(autoExtensionPackPath, "models", "model.yml"),
            index: 0,
            predicate: "sinkModel",
          },
        ],
      },
    };

    extensionPack = await createMockExtensionPack(
      extensionPackPath,
      "my-extension-pack",
    );
    anotherExtensionPack = await createMockExtensionPack(
      anotherExtensionPackPath,
      "another-extension-pack",
    );
    autoExtensionPack = await createMockExtensionPack(
      autoExtensionPackPath,
      "github/vscode-codeql-java",
    );

    showQuickPickSpy = jest
      .spyOn(window, "showQuickPick")
      .mockRejectedValue(new Error("Unexpected call to showQuickPick"));
    showInputBoxSpy = jest
      .spyOn(window, "showInputBox")
      .mockRejectedValue(new Error("Unexpected call to showInputBox"));
    disableAutoNameExtensionPackSpy = jest
      .spyOn(config, "disableAutoNameExtensionPack")
      .mockReturnValue(true);

    workspaceFolder = {
      uri: Uri.file(tmpDir),
      name: "codeql-custom-queries-java",
      index: 0,
    };
    additionalPacks = [tmpDir];
    workspaceFoldersSpy = jest
      .spyOn(workspace, "workspaceFolders", "get")
      .mockReturnValue([workspaceFolder]);
  });

  it("allows choosing an existing extension pack and model file", async () => {
    const modelPath = join(extensionPackPath, "models", "model.yml");

    const cliServer = mockCliServer(qlPacks, extensions);

    showQuickPickSpy.mockResolvedValueOnce({
      label: "my-extension-pack",
      extensionPack,
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce({
      label: "models/model.yml",
      file: modelPath,
    } as QuickPickItem);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual({
      filename: modelPath,
      extensionPack,
    });
    expect(showQuickPickSpy).toHaveBeenCalledTimes(2);
    expect(showQuickPickSpy).toHaveBeenCalledWith(
      [
        {
          label: "my-extension-pack",
          description: "0.0.0",
          detail: extensionPackPath,
          extensionPack,
        },
        {
          label: "another-extension-pack",
          description: "0.0.0",
          detail: anotherExtensionPackPath,
          extensionPack: anotherExtensionPack,
        },
        {
          label: "github/vscode-codeql-java",
          description: "0.0.0",
          detail: autoExtensionPackPath,
          extensionPack: autoExtensionPack,
        },
        {
          label: expect.stringMatching(/create/i),
          extensionPack: null,
        },
      ],
      {
        title: expect.any(String),
      },
      token,
    );
    expect(showQuickPickSpy).toHaveBeenCalledWith(
      [
        {
          label: "models/model.yml",
          file: modelPath,
        },
        {
          label: expect.stringMatching(/create/i),
          file: null,
        },
      ],
      {
        title: expect.any(String),
      },
      token,
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalledTimes(1);
    expect(cliServer.resolveQlpacks).toHaveBeenCalledWith(
      additionalPacks,
      true,
    );
    expect(cliServer.resolveExtensions).toHaveBeenCalledTimes(1);
    expect(cliServer.resolveExtensions).toHaveBeenCalledWith(
      extensionPackPath,
      additionalPacks,
    );
  });

  it("allows choosing an existing extension pack and creating a new model file", async () => {
    const cliServer = mockCliServer(qlPacks, extensions);

    showQuickPickSpy.mockResolvedValueOnce({
      label: "my-extension-pack",
      extensionPack,
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce({
      label: "create",
      file: null,
    } as QuickPickItem);
    showInputBoxSpy.mockResolvedValue("models/my-model.yml");

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual({
      filename: join(extensionPackPath, "models", "my-model.yml"),
      extensionPack,
    });
    expect(showQuickPickSpy).toHaveBeenCalledTimes(2);
    expect(showInputBoxSpy).toHaveBeenCalledWith(
      {
        title: expect.any(String),
        value: "models/github.vscode-codeql.model.yml",
        validateInput: expect.any(Function),
      },
      token,
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalledTimes(1);
    expect(cliServer.resolveQlpacks).toHaveBeenCalledWith(
      additionalPacks,
      true,
    );
    expect(cliServer.resolveExtensions).toHaveBeenCalledTimes(1);
    expect(cliServer.resolveExtensions).toHaveBeenCalledWith(
      extensionPackPath,
      additionalPacks,
    );
  });

  it("automatically selects an extension pack and allows selecting an existing model file", async () => {
    disableAutoNameExtensionPackSpy.mockReturnValue(false);

    const modelPath = join(autoExtensionPackPath, "models", "model.yml");

    const cliServer = mockCliServer(qlPacks, extensions);

    showQuickPickSpy.mockResolvedValueOnce({
      label: "models/model.yml",
      file: modelPath,
    } as QuickPickItem);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual({
      filename: modelPath,
      extensionPack: autoExtensionPack,
    });
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showQuickPickSpy).toHaveBeenCalledWith(
      [
        {
          label: "models/model.yml",
          file: modelPath,
        },
        {
          label: expect.stringMatching(/create/i),
          file: null,
        },
      ],
      {
        title: expect.any(String),
      },
      token,
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalledTimes(1);
    expect(cliServer.resolveQlpacks).toHaveBeenCalledWith(
      additionalPacks,
      true,
    );
    expect(cliServer.resolveExtensions).toHaveBeenCalledTimes(1);
    expect(cliServer.resolveExtensions).toHaveBeenCalledWith(
      autoExtensionPackPath,
      additionalPacks,
    );
  });

  it("automatically creates an extension pack and allows creating a new model file", async () => {
    disableAutoNameExtensionPackSpy.mockReturnValue(false);

    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    workspaceFoldersSpy.mockReturnValue([
      {
        uri: Uri.file("/b/a/c"),
        name: "my-workspace",
        index: 0,
      },
      {
        uri: Uri.file("/a/b/c"),
        name: "codeql-custom-queries-csharp",
        index: 1,
      },
      {
        uri: Uri.file(tmpDir.path),
        name: "codeql-custom-queries-java",
        index: 2,
      },
    ]);

    const newPackDir = join(tmpDir.path, "vscode-codeql-java");

    const cliServer = mockCliServer({}, { models: [], data: {} });

    showInputBoxSpy.mockResolvedValue("models/my-model.yml");

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual({
      filename: join(newPackDir, "models", "my-model.yml"),
      extensionPack: {
        path: newPackDir,
        yamlPath: join(newPackDir, "codeql-pack.yml"),
        name: "github/vscode-codeql-java",
        version: "0.0.0",
        extensionTargets: {
          "codeql/java-all": "*",
        },
        dataExtensions: ["models/**/*.yml"],
      },
    });
    expect(showQuickPickSpy).not.toHaveBeenCalled();
    expect(showInputBoxSpy).toHaveBeenCalledTimes(1);
    expect(showInputBoxSpy).toHaveBeenCalledWith(
      {
        title: expect.stringMatching(/model file/),
        value: "models/github.vscode-codeql.model.yml",
        validateInput: expect.any(Function),
      },
      token,
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).toHaveBeenCalled();

    expect(
      loadYaml(await readFile(join(newPackDir, "codeql-pack.yml"), "utf8")),
    ).toEqual({
      name: "github/vscode-codeql-java",
      version: "0.0.0",
      library: true,
      extensionTargets: {
        "codeql/java-all": "*",
      },
      dataExtensions: ["models/**/*.yml"],
    });
  });

  it("allows cancelling the extension pack prompt", async () => {
    const cliServer = mockCliServer(qlPacks, extensions);

    showQuickPickSpy.mockResolvedValueOnce(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual(undefined);
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).not.toHaveBeenCalled();
  });

  it("allows user to create an extension pack when there are no extension packs", async () => {
    const cliServer = mockCliServer({}, { models: [], data: {} });

    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    const newPackDir = join(tmpDir.path, "new-extension-pack");

    showQuickPickSpy.mockResolvedValueOnce({
      label: "codeql-custom-queries-java",
      folder: {
        uri: Uri.file(tmpDir.path),
        name: "codeql-custom-queries-java",
        index: 0,
      },
    } as QuickPickItem);
    showInputBoxSpy.mockResolvedValueOnce("pack/new-extension-pack");
    showInputBoxSpy.mockResolvedValue("models/my-model.yml");

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual({
      filename: join(newPackDir, "models", "my-model.yml"),
      extensionPack: {
        path: newPackDir,
        yamlPath: join(newPackDir, "codeql-pack.yml"),
        name: "pack/new-extension-pack",
        version: "0.0.0",
        extensionTargets: {
          "codeql/java-all": "*",
        },
        dataExtensions: ["models/**/*.yml"],
      },
    });
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showInputBoxSpy).toHaveBeenCalledTimes(2);
    expect(showInputBoxSpy).toHaveBeenCalledWith(
      {
        title: expect.stringMatching(/extension pack/i),
        prompt: expect.stringMatching(/extension pack/i),
        placeHolder: expect.stringMatching(/github\/vscode-codeql-java/),
        validateInput: expect.any(Function),
      },
      token,
    );
    expect(showInputBoxSpy).toHaveBeenCalledWith(
      {
        title: expect.stringMatching(/model file/),
        value: "models/github.vscode-codeql.model.yml",
        validateInput: expect.any(Function),
      },
      token,
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).toHaveBeenCalled();

    expect(
      loadYaml(await readFile(join(newPackDir, "codeql-pack.yml"), "utf8")),
    ).toEqual({
      name: "pack/new-extension-pack",
      version: "0.0.0",
      library: true,
      extensionTargets: {
        "codeql/java-all": "*",
      },
      dataExtensions: ["models/**/*.yml"],
    });
  });

  it("allows user to create an extension pack when there are no extension packs with a different language", async () => {
    const cliServer = mockCliServer({}, { models: [], data: {} });

    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    const newPackDir = join(tmpDir.path, "new-extension-pack");

    showQuickPickSpy.mockResolvedValueOnce({
      label: "codeql-custom-queries-java",
      folder: {
        uri: Uri.file(tmpDir.path),
        name: "codeql-custom-queries-java",
        index: 0,
      },
    } as QuickPickItem);
    showInputBoxSpy.mockResolvedValueOnce("pack/new-extension-pack");
    showInputBoxSpy.mockResolvedValue("models/my-model.yml");

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        {
          ...databaseItem,
          language: "csharp",
        },
        logger,
        progress,
        token,
      ),
    ).toEqual({
      filename: join(newPackDir, "models", "my-model.yml"),
      extensionPack: {
        path: newPackDir,
        yamlPath: join(newPackDir, "codeql-pack.yml"),
        name: "pack/new-extension-pack",
        version: "0.0.0",
        extensionTargets: {
          "codeql/csharp-all": "*",
        },
        dataExtensions: ["models/**/*.yml"],
      },
    });
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showInputBoxSpy).toHaveBeenCalledTimes(2);
    expect(showInputBoxSpy).toHaveBeenCalledWith(
      {
        title: expect.stringMatching(/extension pack/i),
        prompt: expect.stringMatching(/extension pack/i),
        placeHolder: expect.stringMatching(/github\/vscode-codeql-csharp/),
        validateInput: expect.any(Function),
      },
      token,
    );
    expect(showInputBoxSpy).toHaveBeenCalledWith(
      {
        title: expect.stringMatching(/model file/),
        value: "models/github.vscode-codeql.model.yml",
        validateInput: expect.any(Function),
      },
      token,
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).toHaveBeenCalled();

    expect(
      loadYaml(await readFile(join(newPackDir, "codeql-pack.yml"), "utf8")),
    ).toEqual({
      name: "pack/new-extension-pack",
      version: "0.0.0",
      library: true,
      extensionTargets: {
        "codeql/csharp-all": "*",
      },
      dataExtensions: ["models/**/*.yml"],
    });
  });

  it("allows cancelling the workspace folder selection", async () => {
    const cliServer = mockCliServer({}, { models: [], data: {} });

    showQuickPickSpy.mockResolvedValueOnce(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual(undefined);
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showInputBoxSpy).toHaveBeenCalledTimes(0);
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).not.toHaveBeenCalled();
  });

  it("allows cancelling the extension pack name input", async () => {
    const cliServer = mockCliServer({}, { models: [], data: {} });

    showQuickPickSpy.mockResolvedValueOnce({
      label: "codeql-custom-queries-java",
      folder: {
        uri: Uri.file("/a/b/c"),
        name: "codeql-custom-queries-java",
        index: 0,
      },
    } as QuickPickItem);
    showInputBoxSpy.mockResolvedValueOnce(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual(undefined);
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showInputBoxSpy).toHaveBeenCalledTimes(1);
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).not.toHaveBeenCalled();
  });

  it("shows an error when an extension pack resolves to more than 1 location", async () => {
    const cliServer = mockCliServer(
      {
        "my-extension-pack": [
          "/a/b/c/my-extension-pack",
          "/a/b/c/my-extension-pack2",
        ],
      },
      { models: [], data: {} },
    );

    showQuickPickSpy.mockResolvedValueOnce(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual(undefined);
    expect(logger.showErrorMessage).toHaveBeenCalledTimes(1);
    expect(logger.showErrorMessage).toHaveBeenCalledWith(
      expect.stringMatching(/resolves to multiple paths/),
    );
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showQuickPickSpy).toHaveBeenCalledWith(
      [
        {
          label: expect.stringMatching(/create/i),
          extensionPack: null,
        },
      ],
      {
        title: "Select extension pack to use",
      },
      token,
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).not.toHaveBeenCalled();
  });

  it("allows cancelling the model file prompt", async () => {
    const cliServer = mockCliServer(qlPacks, extensions);

    showQuickPickSpy.mockResolvedValueOnce({
      label: "my-extension-pack",
      extensionPack,
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual(undefined);
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).toHaveBeenCalled();
  });

  it("shows create input box when there are no model files", async () => {
    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    const extensionPack = await createMockExtensionPack(
      tmpDir.path,
      "no-extension-pack",
    );

    const cliServer = mockCliServer(
      {
        "no-extension-pack": [tmpDir.path],
      },
      { models: [], data: {} },
    );

    showQuickPickSpy.mockResolvedValueOnce({
      label: "no-extension-pack",
      extensionPack,
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce(undefined);
    showInputBoxSpy.mockResolvedValue("models/my-model.yml");

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual({
      filename: join(tmpDir.path, "models", "my-model.yml"),
      extensionPack,
    });
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showInputBoxSpy).toHaveBeenCalledWith(
      {
        title: expect.any(String),
        value: "models/github.vscode-codeql.model.yml",
        validateInput: expect.any(Function),
      },
      token,
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).toHaveBeenCalled();
  });

  it("shows an error when there is no pack YAML file", async () => {
    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    const cliServer = mockCliServer(
      {
        "my-extension-pack": [tmpDir.path],
      },
      { models: [], data: {} },
    );

    showQuickPickSpy.mockResolvedValueOnce(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual(undefined);
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showQuickPickSpy).toHaveBeenCalledWith(
      [
        {
          label: expect.stringMatching(/create/i),
          extensionPack: null,
        },
      ],
      {
        title: "Select extension pack to use",
      },
      token,
    );
    expect(showInputBoxSpy).not.toHaveBeenCalled();
    expect(logger.showErrorMessage).toHaveBeenCalledTimes(1);
    expect(logger.showErrorMessage).toHaveBeenCalledWith(
      expect.stringMatching(/my-extension-pack/),
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).not.toHaveBeenCalled();
  });

  it("shows an error when the pack YAML file is invalid", async () => {
    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    const cliServer = mockCliServer(
      {
        "my-extension-pack": [tmpDir.path],
      },
      { models: [], data: {} },
    );

    await outputFile(join(tmpDir.path, "codeql-pack.yml"), dumpYaml("java"));

    showQuickPickSpy.mockResolvedValueOnce(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual(undefined);
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showQuickPickSpy).toHaveBeenCalledWith(
      [
        {
          label: expect.stringMatching(/create/i),
          extensionPack: null,
        },
      ],
      {
        title: "Select extension pack to use",
      },
      token,
    );
    expect(showInputBoxSpy).not.toHaveBeenCalled();
    expect(logger.showErrorMessage).toHaveBeenCalledTimes(1);
    expect(logger.showErrorMessage).toHaveBeenCalledWith(
      expect.stringMatching(/my-extension-pack/),
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).not.toHaveBeenCalled();
  });

  it("shows an error when the pack YAML does not contain dataExtensions", async () => {
    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    const cliServer = mockCliServer(
      {
        "my-extension-pack": [tmpDir.path],
      },
      { models: [], data: {} },
    );

    await outputFile(
      join(tmpDir.path, "codeql-pack.yml"),
      dumpYaml({
        name: "my-extension-pack",
        version: "0.0.0",
        library: true,
        extensionTargets: {
          "codeql/java-all": "*",
        },
      }),
    );

    showQuickPickSpy.mockResolvedValueOnce(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual(undefined);
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showQuickPickSpy).toHaveBeenCalledWith(
      [
        {
          label: expect.stringMatching(/create/i),
          extensionPack: null,
        },
      ],
      {
        title: "Select extension pack to use",
      },
      token,
    );
    expect(showInputBoxSpy).not.toHaveBeenCalled();
    expect(logger.showErrorMessage).toHaveBeenCalledTimes(1);
    expect(logger.showErrorMessage).toHaveBeenCalledWith(
      expect.stringMatching(/my-extension-pack/),
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).not.toHaveBeenCalled();
  });

  it("shows an error when the pack YAML dataExtensions is invalid", async () => {
    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    const cliServer = mockCliServer(
      {
        "my-extension-pack": [tmpDir.path],
      },
      { models: [], data: {} },
    );

    await outputFile(
      join(tmpDir.path, "codeql-pack.yml"),
      dumpYaml({
        name: "my-extension-pack",
        version: "0.0.0",
        library: true,
        extensionTargets: {
          "codeql/java-all": "*",
        },
        dataExtensions: {
          "codeql/java-all": "invalid",
        },
      }),
    );

    showQuickPickSpy.mockResolvedValueOnce(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual(undefined);
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showQuickPickSpy).toHaveBeenCalledWith(
      [
        {
          label: expect.stringMatching(/create/i),
          extensionPack: null,
        },
      ],
      {
        title: "Select extension pack to use",
      },
      token,
    );
    expect(showInputBoxSpy).not.toHaveBeenCalled();
    expect(logger.showErrorMessage).toHaveBeenCalledTimes(1);
    expect(logger.showErrorMessage).toHaveBeenCalledWith(
      expect.stringMatching(/my-extension-pack/),
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).not.toHaveBeenCalled();
  });

  it("allows cancelling the new file input box", async () => {
    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    const newExtensionPack = await createMockExtensionPack(
      tmpDir.path,
      "new-extension-pack",
    );

    const cliServer = mockCliServer(
      {
        "my-extension-pack": [tmpDir.path],
      },
      {
        models: [],
        data: {},
      },
    );

    showQuickPickSpy.mockResolvedValueOnce({
      label: "new-extension-pack",
      extensionPack: newExtensionPack,
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce(undefined);
    showInputBoxSpy.mockResolvedValue(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual(undefined);
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showInputBoxSpy).toHaveBeenCalledTimes(1);
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).toHaveBeenCalled();
  });

  it("validates the pack name input", async () => {
    const cliServer = mockCliServer({}, { models: [], data: {} });

    showQuickPickSpy.mockResolvedValueOnce({
      label: "a",
      folder: {
        uri: Uri.file("/a/b/c"),
        name: "a",
        index: 0,
      },
    } as QuickPickItem);
    showInputBoxSpy.mockResolvedValue(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual(undefined);

    const validateFile = showInputBoxSpy.mock.calls[0][0]?.validateInput;
    expect(validateFile).toBeDefined();
    if (!validateFile) {
      return;
    }

    expect(await validateFile("")).toEqual("Pack name must not be empty");
    expect(await validateFile("a".repeat(129))).toEqual(
      "Pack name must be no longer than 128 characters",
    );
    expect(await validateFile("github/vscode-codeql/extensions")).toEqual(
      "Invalid package name: a pack name must contain only lowercase ASCII letters, ASCII digits, and hyphens",
    );
    expect(await validateFile("VSCODE")).toEqual(
      "Invalid package name: a pack name must contain a slash to separate the scope from the pack name",
    );
    expect(await validateFile("github/")).toEqual(
      "Invalid package name: a pack name must contain only lowercase ASCII letters, ASCII digits, and hyphens",
    );
    expect(await validateFile("github/VSCODE")).toEqual(
      "Invalid package name: a pack name must contain only lowercase ASCII letters, ASCII digits, and hyphens",
    );
    expect(await validateFile("github/vscode-codeql-")).toEqual(
      "Invalid package name: a pack name must contain only lowercase ASCII letters, ASCII digits, and hyphens",
    );
    expect(
      await validateFile("github/vscode-codeql-extensions"),
    ).toBeUndefined();
    expect(await validateFile("pack/vscode-codeql-extensions")).toBeUndefined();
  });

  it("validates the file input", async () => {
    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    const extensionPack = await createMockExtensionPack(
      tmpDir.path,
      "new-extension-pack",
      {
        dataExtensions: ["models/**/*.yml", "data/**/*.yml"],
      },
    );

    const cliServer = mockCliServer(
      {
        "new-extension-pack": [extensionPack.path],
      },
      { models: [], data: {} },
    );

    await outputFile(
      join(extensionPack.path, "models", "model.yml"),
      dumpYaml({
        extensions: [],
      }),
    );

    showQuickPickSpy.mockResolvedValueOnce({
      label: "new-extension-pack",
      extensionPack,
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce(undefined);
    showInputBoxSpy.mockResolvedValue(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual(undefined);

    const validateFile = showInputBoxSpy.mock.calls[0][0]?.validateInput;
    expect(validateFile).toBeDefined();
    if (!validateFile) {
      return;
    }

    expect(await validateFile("")).toEqual("File name must not be empty");
    expect(await validateFile("models/model.yml")).toEqual(
      "File already exists",
    );
    expect(await validateFile("../model.yml")).toEqual(
      "File must be in the extension pack",
    );
    expect(await validateFile("/home/user/model.yml")).toEqual(
      "File must be in the extension pack",
    );
    expect(await validateFile("model.yml")).toEqual(
      `File must match one of the patterns in 'dataExtensions' in ${extensionPack.yamlPath}`,
    );
    expect(await validateFile("models/model.yaml")).toEqual(
      `File must match one of the patterns in 'dataExtensions' in ${extensionPack.yamlPath}`,
    );
    expect(await validateFile("models/my-model.yml")).toBeUndefined();
    expect(await validateFile("models/nested/model.yml")).toBeUndefined();
    expect(await validateFile("data/model.yml")).toBeUndefined();
  });

  it("allows the dataExtensions to be a string", async () => {
    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    const cliServer = mockCliServer(
      {
        "new-extension-pack": [tmpDir.path],
      },
      { models: [], data: {} },
    );

    const qlpackPath = join(tmpDir.path, "codeql-pack.yml");
    await outputFile(
      qlpackPath,
      dumpYaml({
        name: "new-extension-pack",
        version: "0.0.0",
        library: true,
        extensionTargets: {
          "codeql/java-all": "*",
        },
        dataExtensions: "models/**/*.yml",
      }),
    );
    await outputFile(
      join(tmpDir.path, "models", "model.yml"),
      dumpYaml({
        extensions: [],
      }),
    );

    showQuickPickSpy.mockResolvedValueOnce({
      label: "new-extension-pack",
      extensionPack: {
        path: tmpDir.path,
        yamlPath: qlpackPath,
        name: "new-extension-pack",
        version: "0.0.0",
        extensionTargets: {
          "codeql/java-all": "*",
        },
        dataExtensions: ["models/**/*.yml"],
      },
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce(undefined);
    showInputBoxSpy.mockResolvedValue(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        logger,
        progress,
        token,
      ),
    ).toEqual(undefined);

    const validateFile = showInputBoxSpy.mock.calls[0][0]?.validateInput;
    expect(validateFile).toBeDefined();
    if (!validateFile) {
      return;
    }

    expect(await validateFile("models/my-model.yml")).toBeUndefined();
  });

  it("only shows extension packs for the database language", async () => {
    const csharpPack = await createMockExtensionPack(
      join(tmpDir, "csharp-extensions"),
      "csharp-extension-pack",
      {
        version: "0.5.3",
        extensionTargets: {
          "codeql/csharp-all": "*",
        },
      },
    );

    const cliServer = mockCliServer(
      {
        ...qlPacks,
        "csharp-extension-pack": [csharpPack.path],
      },
      extensions,
    );

    showQuickPickSpy.mockResolvedValueOnce(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        {
          ...databaseItem,
          language: "csharp",
        },
        logger,
        progress,
        token,
      ),
    ).toEqual(undefined);
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showQuickPickSpy).toHaveBeenCalledWith(
      [
        {
          label: "csharp-extension-pack",
          description: "0.5.3",
          detail: csharpPack.path,
          extensionPack: csharpPack,
        },
        {
          label: expect.stringMatching(/create/i),
          extensionPack: null,
        },
      ],
      {
        title: expect.any(String),
      },
      token,
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalledTimes(1);
    expect(cliServer.resolveQlpacks).toHaveBeenCalledWith(
      additionalPacks,
      true,
    );
    expect(cliServer.resolveExtensions).not.toHaveBeenCalled();
  });
});

function mockCliServer(
  qlpacks: QlpacksInfo,
  extensions: ResolveExtensionsResult,
) {
  return {
    resolveQlpacks: jest.fn().mockResolvedValue(qlpacks),
    resolveExtensions: jest.fn().mockResolvedValue(extensions),
  };
}

async function createMockExtensionPack(
  path: string,
  name: string,
  data: Partial<ExtensionPack> = {},
): Promise<ExtensionPack> {
  const extensionPack: ExtensionPack = {
    path,
    yamlPath: join(path, "codeql-pack.yml"),
    name,
    version: "0.0.0",
    extensionTargets: {
      "codeql/java-all": "*",
    },
    dataExtensions: ["models/**/*.yml"],
    ...data,
  };

  await writeExtensionPackToDisk(extensionPack);

  return extensionPack;
}

async function writeExtensionPackToDisk(
  extensionPack: ExtensionPack,
): Promise<void> {
  await outputFile(
    extensionPack.yamlPath,
    dumpYaml({
      name: extensionPack.name,
      version: extensionPack.version,
      library: true,
      extensionTargets: extensionPack.extensionTargets,
      dataExtensions: extensionPack.dataExtensions,
    }),
  );
}
