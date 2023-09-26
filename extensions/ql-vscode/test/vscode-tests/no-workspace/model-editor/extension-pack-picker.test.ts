import {
  ConfigurationScope,
  Uri,
  workspace,
  WorkspaceConfiguration as VSCodeWorkspaceConfiguration,
  WorkspaceFolder,
} from "vscode";
import { dump as dumpYaml, load as loadYaml } from "js-yaml";
import { outputFile, readFile } from "fs-extra";
import { join } from "path";
import { dir } from "tmp-promise";
import { QlpacksInfo } from "../../../../src/codeql-cli/cli";

import { pickExtensionPack } from "../../../../src/model-editor/extension-pack-picker";
import { ExtensionPack } from "../../../../src/model-editor/shared/extension-pack";
import { createMockLogger } from "../../../__mocks__/loggerMock";
import { vscodeGetConfigurationMock } from "../../test-config";

describe("pickExtensionPack", () => {
  let tmpDir: string;
  const autoExtensionPackName = "github/vscode-codeql-java";
  let autoExtensionPackPath: string;
  let autoExtensionPack: ExtensionPack;

  let qlPacks: QlpacksInfo;
  const databaseItem = {
    name: "github/vscode-codeql",
    language: "java",
  };

  const progress = jest.fn();
  let workspaceFoldersSpy: jest.SpyInstance;
  let additionalPacks: string[];
  let workspaceFolder: WorkspaceFolder;

  const logger = createMockLogger();
  const maxStep = 4;

  beforeEach(async () => {
    tmpDir = (
      await dir({
        unsafeCleanup: true,
      })
    ).path;

    // Uri.file(...).fsPath normalizes the filenames so we can properly compare them on Windows
    autoExtensionPackPath = Uri.file(join(tmpDir, "vscode-codeql-java")).fsPath;

    qlPacks = {
      "github/vscode-codeql-java": [autoExtensionPackPath],
    };

    autoExtensionPack = await createMockExtensionPack(
      autoExtensionPackPath,
      autoExtensionPackName,
    );

    workspaceFolder = {
      uri: Uri.file(tmpDir),
      name: "codeql-custom-queries-java",
      index: 0,
    };
    additionalPacks = [
      Uri.file(tmpDir).fsPath,
      `${Uri.file(tmpDir).fsPath}/.github`,
    ];
    workspaceFoldersSpy = jest
      .spyOn(workspace, "workspaceFolders", "get")
      .mockReturnValue([workspaceFolder]);
  });

  it("selects an existing extension pack", async () => {
    vscodeGetConfigurationMock.mockImplementation(
      (
        section?: string,
        scope?: ConfigurationScope | null,
      ): VSCodeWorkspaceConfiguration => {
        expect(section).toEqual("codeQL.model");
        expect((scope as any)?.languageId).toEqual("java");

        return {
          get: (key: string) => {
            expect(key).toEqual("extensionsDirectory");
            return undefined;
          },
          has: (key: string) => {
            return key === "extensionsDirectory";
          },
          inspect: () => {
            throw new Error("inspect not implemented");
          },
          update: () => {
            throw new Error("update not implemented");
          },
        };
      },
    );

    const cliServer = mockCliServer(qlPacks);

    expect(
      await pickExtensionPack(
        cliServer,
        databaseItem,
        logger,
        progress,
        maxStep,
      ),
    ).toEqual(autoExtensionPack);
    expect(cliServer.resolveQlpacks).toHaveBeenCalledTimes(1);
    expect(cliServer.resolveQlpacks).toHaveBeenCalledWith(
      additionalPacks,
      true,
    );
  });

  it("creates a new extension pack using default extensions directory", async () => {
    vscodeGetConfigurationMock.mockImplementation(
      (
        section?: string,
        scope?: ConfigurationScope | null,
      ): VSCodeWorkspaceConfiguration => {
        expect(section).toEqual("codeQL.model");
        expect((scope as any)?.languageId).toEqual("java");

        return {
          get: (key: string) => {
            expect(key).toEqual("extensionsDirectory");
            return undefined;
          },
          has: (key: string) => {
            return key === "extensionsDirectory";
          },
          inspect: () => {
            throw new Error("inspect not implemented");
          },
          update: () => {
            throw new Error("update not implemented");
          },
        };
      },
    );

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
        uri: Uri.joinPath(Uri.file(tmpDir.path), "codeql-custom-queries-java"),
        name: "codeql-custom-queries-java",
        index: 2,
      },
    ]);
    jest
      .spyOn(workspace, "workspaceFile", "get")
      .mockReturnValue(
        Uri.joinPath(Uri.file(tmpDir.path), "workspace.code-workspace"),
      );
    jest.spyOn(workspace, "updateWorkspaceFolders").mockReturnValue(true);

    const newPackDir = join(
      Uri.file(tmpDir.path).fsPath,
      ".github",
      "codeql",
      "extensions",
      "vscode-codeql-java",
    );

    const cliServer = mockCliServer({});

    expect(
      await pickExtensionPack(
        cliServer,
        databaseItem,
        logger,
        progress,
        maxStep,
      ),
    ).toEqual({
      path: newPackDir,
      yamlPath: join(newPackDir, "codeql-pack.yml"),
      name: autoExtensionPackName,
      version: "0.0.0",
      language: "java",
      extensionTargets: {
        "codeql/java-all": "*",
      },
      dataExtensions: ["models/**/*.yml"],
    });
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();

    expect(
      loadYaml(await readFile(join(newPackDir, "codeql-pack.yml"), "utf8")),
    ).toEqual({
      name: autoExtensionPackName,
      version: "0.0.0",
      library: true,
      extensionTargets: {
        "codeql/java-all": "*",
      },
      dataExtensions: ["models/**/*.yml"],
    });
  });

  it("creates a new extension pack when extensions directory is set in config", async () => {
    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    const configExtensionsDir = join(
      Uri.file(tmpDir.path).fsPath,
      "my-custom-extensions-directory",
    );

    vscodeGetConfigurationMock.mockImplementation(
      (
        section?: string,
        scope?: ConfigurationScope | null,
      ): VSCodeWorkspaceConfiguration => {
        expect(section).toEqual("codeQL.model");
        expect((scope as any)?.languageId).toEqual("java");

        return {
          get: (key: string) => {
            expect(key).toEqual("extensionsDirectory");
            return configExtensionsDir;
          },
          has: (key: string) => {
            return key === "extensionsDirectory";
          },
          inspect: () => {
            throw new Error("inspect not implemented");
          },
          update: () => {
            throw new Error("update not implemented");
          },
        };
      },
    );

    const newPackDir = join(configExtensionsDir, "vscode-codeql-java");

    const cliServer = mockCliServer({});

    expect(
      await pickExtensionPack(
        cliServer,
        databaseItem,
        logger,
        progress,
        maxStep,
      ),
    ).toEqual({
      path: newPackDir,
      yamlPath: join(newPackDir, "codeql-pack.yml"),
      name: autoExtensionPackName,
      version: "0.0.0",
      language: "java",
      extensionTargets: {
        "codeql/java-all": "*",
      },
      dataExtensions: ["models/**/*.yml"],
    });
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();

    expect(
      loadYaml(await readFile(join(newPackDir, "codeql-pack.yml"), "utf8")),
    ).toEqual({
      name: autoExtensionPackName,
      version: "0.0.0",
      library: true,
      extensionTargets: {
        "codeql/java-all": "*",
      },
      dataExtensions: ["models/**/*.yml"],
    });
  });

  it("shows an error when an extension pack resolves to more than 1 location", async () => {
    const cliServer = mockCliServer({
      "github/vscode-codeql-java": [
        "/a/b/c/my-extension-pack",
        "/a/b/c/my-extension-pack2",
      ],
    });

    expect(
      await pickExtensionPack(
        cliServer,
        databaseItem,
        logger,
        progress,
        maxStep,
      ),
    ).toEqual(undefined);
    expect(logger.showErrorMessage).toHaveBeenCalledTimes(1);
    expect(logger.showErrorMessage).toHaveBeenCalledWith(
      expect.stringMatching(/resolves to multiple paths/),
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
  });

  it("shows an error when there is no pack YAML file", async () => {
    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    const cliServer = mockCliServer({
      "github/vscode-codeql-java": [tmpDir.path],
    });

    expect(
      await pickExtensionPack(
        cliServer,
        databaseItem,
        logger,
        progress,
        maxStep,
      ),
    ).toEqual(undefined);
    expect(logger.showErrorMessage).toHaveBeenCalledTimes(1);
    expect(logger.showErrorMessage).toHaveBeenCalledWith(
      "Could not read model pack github/vscode-codeql-java",
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
  });

  it("shows an error when the pack YAML file is invalid", async () => {
    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    const cliServer = mockCliServer({
      "github/vscode-codeql-java": [tmpDir.path],
    });

    await outputFile(join(tmpDir.path, "codeql-pack.yml"), dumpYaml("java"));

    expect(
      await pickExtensionPack(
        cliServer,
        databaseItem,
        logger,
        progress,
        maxStep,
      ),
    ).toEqual(undefined);
    expect(logger.showErrorMessage).toHaveBeenCalledTimes(1);
    expect(logger.showErrorMessage).toHaveBeenCalledWith(
      "Could not read model pack github/vscode-codeql-java",
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
  });

  it("shows an error when the pack YAML does not contain dataExtensions", async () => {
    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    const cliServer = mockCliServer({
      "github/vscode-codeql-java": [tmpDir.path],
    });

    await outputFile(
      join(tmpDir.path, "codeql-pack.yml"),
      dumpYaml({
        name: autoExtensionPackName,
        version: "0.0.0",
        library: true,
        extensionTargets: {
          "codeql/java-all": "*",
        },
      }),
    );

    expect(
      await pickExtensionPack(
        cliServer,
        databaseItem,
        logger,
        progress,
        maxStep,
      ),
    ).toEqual(undefined);
    expect(logger.showErrorMessage).toHaveBeenCalledTimes(1);
    expect(logger.showErrorMessage).toHaveBeenCalledWith(
      "Could not read model pack github/vscode-codeql-java",
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
  });

  it("shows an error when the pack YAML dataExtensions is invalid", async () => {
    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    const cliServer = mockCliServer({
      "github/vscode-codeql-java": [tmpDir.path],
    });

    await outputFile(
      join(tmpDir.path, "codeql-pack.yml"),
      dumpYaml({
        name: autoExtensionPackName,
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

    expect(
      await pickExtensionPack(
        cliServer,
        databaseItem,
        logger,
        progress,
        maxStep,
      ),
    ).toEqual(undefined);
    expect(logger.showErrorMessage).toHaveBeenCalledTimes(1);
    expect(logger.showErrorMessage).toHaveBeenCalledWith(
      "Could not read model pack github/vscode-codeql-java",
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
  });

  it("allows the dataExtensions to be a string", async () => {
    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    const cliServer = mockCliServer({
      "github/vscode-codeql-java": [tmpDir.path],
    });

    const qlpackPath = join(tmpDir.path, "codeql-pack.yml");
    await outputFile(
      qlpackPath,
      dumpYaml({
        name: autoExtensionPackName,
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

    const extensionPack = {
      path: tmpDir.path,
      yamlPath: qlpackPath,
      name: autoExtensionPackName,
      version: "0.0.0",
      language: "java",
      extensionTargets: {
        "codeql/java-all": "*",
      },
      dataExtensions: ["models/**/*.yml"],
    };

    expect(
      await pickExtensionPack(
        cliServer,
        databaseItem,
        logger,
        progress,
        maxStep,
      ),
    ).toEqual(extensionPack);
  });
});

function mockCliServer(qlpacks: QlpacksInfo) {
  return {
    resolveQlpacks: jest.fn().mockResolvedValue(qlpacks),
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
    language: "java",
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
