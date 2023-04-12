import { CancellationTokenSource, QuickPickItem, window } from "vscode";
import { dump as dumpYaml, load as loadYaml } from "js-yaml";
import { outputFile, readFile } from "fs-extra";
import { join } from "path";
import { dir } from "tmp-promise";

import { pickExtensionPackModelFile } from "../../../../src/data-extensions-editor/extension-pack-picker";
import { QlpacksInfo, ResolveExtensionsResult } from "../../../../src/cli";
import * as helpers from "../../../../src/helpers";

describe("pickExtensionPackModelFile", () => {
  const qlPacks = {
    "my-extension-pack": ["/a/b/c/my-extension-pack"],
    "another-extension-pack": ["/a/b/c/another-extension-pack"],
  };
  const extensions = {
    models: [],
    data: {
      "/a/b/c/my-extension-pack": [
        {
          file: "/a/b/c/my-extension-pack/models/model.yml",
          index: 0,
          predicate: "sinkModel",
        },
      ],
    },
  };
  const databaseItem = {
    name: "github/vscode-codeql",
  };

  const cancellationTokenSource = new CancellationTokenSource();
  const token = cancellationTokenSource.token;

  const progress = jest.fn();
  let showQuickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;
  let showInputBoxSpy: jest.SpiedFunction<typeof window.showInputBox>;
  let showAndLogErrorMessageSpy: jest.SpiedFunction<
    typeof helpers.showAndLogErrorMessage
  >;

  beforeEach(() => {
    showQuickPickSpy = jest
      .spyOn(window, "showQuickPick")
      .mockRejectedValue(new Error("Unexpected call to showQuickPick"));
    showInputBoxSpy = jest
      .spyOn(window, "showInputBox")
      .mockRejectedValue(new Error("Unexpected call to showInputBox"));
    showAndLogErrorMessageSpy = jest
      .spyOn(helpers, "showAndLogErrorMessage")
      .mockImplementation((msg) => {
        throw new Error(`Unexpected call to showAndLogErrorMessage: ${msg}`);
      });
  });

  it("allows choosing an existing extension pack and model file", async () => {
    const cliServer = mockCliServer(qlPacks, extensions);

    showQuickPickSpy.mockResolvedValueOnce({
      label: "my-extension-pack",
      extensionPack: "my-extension-pack",
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce({
      label: "models/model.yml",
      file: "/a/b/c/my-extension-pack/models/model.yml",
    } as QuickPickItem);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        progress,
        token,
      ),
    ).toEqual("/a/b/c/my-extension-pack/models/model.yml");
    expect(showQuickPickSpy).toHaveBeenCalledTimes(2);
    expect(showQuickPickSpy).toHaveBeenCalledWith(
      [
        {
          label: "my-extension-pack",
          extensionPack: "my-extension-pack",
        },
        {
          label: "another-extension-pack",
          extensionPack: "another-extension-pack",
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
          file: "/a/b/c/my-extension-pack/models/model.yml",
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
    expect(cliServer.resolveQlpacks).toHaveBeenCalledWith([], true);
    expect(cliServer.resolveExtensions).toHaveBeenCalledTimes(1);
    expect(cliServer.resolveExtensions).toHaveBeenCalledWith(
      "/a/b/c/my-extension-pack",
      [],
    );
  });

  it("allows choosing an existing extension pack and creating a new model file", async () => {
    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    const cliServer = mockCliServer(
      {
        ...qlPacks,
        "my-extension-pack": [tmpDir.path],
      },
      {
        models: extensions.models,
        data: {
          [tmpDir.path]: [
            {
              file: join(tmpDir.path, "models/model.yml"),
              index: 0,
              predicate: "sinkModel",
            },
          ],
        },
      },
    );

    showQuickPickSpy.mockResolvedValueOnce({
      label: "my-extension-pack",
      extensionPack: "my-extension-pack",
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce({
      label: "create",
      file: null,
    } as QuickPickItem);
    showInputBoxSpy.mockResolvedValue("models/my-model.yml");

    await outputFile(
      join(tmpDir.path, "codeql-pack.yml"),
      dumpYaml({
        name: "my-extension-pack",
        version: "0.0.0",
        library: true,
        extensionTargets: {
          "codeql/java-all": "*",
        },
        dataExtensions: ["models/**/*.yml"],
      }),
    );

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        progress,
        token,
      ),
    ).toEqual(join(tmpDir.path, "models/my-model.yml"));
    expect(showQuickPickSpy).toHaveBeenCalledTimes(2);
    expect(showQuickPickSpy).toHaveBeenCalledWith(
      [
        {
          label: "my-extension-pack",
          extensionPack: "my-extension-pack",
        },
        {
          label: "another-extension-pack",
          extensionPack: "another-extension-pack",
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
          file: join(tmpDir.path, "models/model.yml"),
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
    expect(showInputBoxSpy).toHaveBeenCalledWith(
      {
        title: expect.any(String),
        value: "models/github.vscode-codeql.model.yml",
        validateInput: expect.any(Function),
      },
      token,
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalledTimes(1);
    expect(cliServer.resolveQlpacks).toHaveBeenCalledWith([], true);
    expect(cliServer.resolveExtensions).toHaveBeenCalledTimes(1);
    expect(cliServer.resolveExtensions).toHaveBeenCalledWith(tmpDir.path, []);
  });

  it("allows cancelling the extension pack prompt", async () => {
    const cliServer = mockCliServer(qlPacks, extensions);

    showQuickPickSpy.mockResolvedValueOnce(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
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

    showQuickPickSpy.mockResolvedValueOnce({
      label: "codeql-custom-queries-java",
      path: tmpDir.path,
    } as QuickPickItem);
    showInputBoxSpy.mockResolvedValueOnce("my-extension-pack");
    showInputBoxSpy.mockResolvedValue("models/my-model.yml");

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        progress,
        token,
      ),
    ).toEqual(join(tmpDir.path, "my-extension-pack", "models", "my-model.yml"));
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showInputBoxSpy).toHaveBeenCalledTimes(2);
    expect(showInputBoxSpy).toHaveBeenCalledWith(
      {
        title: expect.stringMatching(/extension pack/i),
        prompt: expect.stringMatching(/extension pack/i),
        placeHolder: expect.stringMatching(/github\/vscode-codeql-extensions/),
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
      loadYaml(
        await readFile(
          join(tmpDir.path, "my-extension-pack", "codeql-pack.yml"),
          "utf8",
        ),
      ),
    ).toEqual({
      name: "my-extension-pack",
      version: "0.0.0",
      library: true,
      extensionTargets: {
        "codeql/java-all": "*",
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
      path: "/a/b/c",
    } as QuickPickItem);
    showInputBoxSpy.mockResolvedValueOnce(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
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
    showAndLogErrorMessageSpy.mockResolvedValue(undefined);

    const cliServer = mockCliServer(
      {
        "my-extension-pack": [
          "/a/b/c/my-extension-pack",
          "/a/b/c/my-extension-pack2",
        ],
      },
      { models: [], data: {} },
    );

    showQuickPickSpy.mockResolvedValueOnce({
      label: "my-extension-pack",
      extensionPack: "my-extension-pack",
    } as QuickPickItem);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        progress,
        token,
      ),
    ).toEqual(undefined);
    expect(showAndLogErrorMessageSpy).toHaveBeenCalledTimes(1);
    expect(showAndLogErrorMessageSpy).toHaveBeenCalledWith(
      expect.stringMatching(/could not be resolved to a single location/),
      expect.anything(),
    );
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).not.toHaveBeenCalled();
  });

  it("allows cancelling the model file prompt", async () => {
    const cliServer = mockCliServer(qlPacks, extensions);

    showQuickPickSpy.mockResolvedValueOnce({
      label: "my-extension-pack",
      extensionPack: "my-extension-pack",
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
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
        dataExtensions: ["models/**/*.yml"],
      }),
    );

    showQuickPickSpy.mockResolvedValueOnce({
      label: "my-extension-pack",
      extensionPack: "my-extension-pack",
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce(undefined);
    showInputBoxSpy.mockResolvedValue("models/my-model.yml");

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        progress,
        token,
      ),
    ).toEqual(join(tmpDir.path, "models/my-model.yml"));
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

    showQuickPickSpy.mockResolvedValueOnce({
      label: "my-extension-pack",
      extensionPack: "my-extension-pack",
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce(undefined);
    showAndLogErrorMessageSpy.mockResolvedValue(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        progress,
        token,
      ),
    ).toEqual(undefined);
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showInputBoxSpy).not.toHaveBeenCalled();
    expect(showAndLogErrorMessageSpy).toHaveBeenCalledTimes(1);
    expect(showAndLogErrorMessageSpy).toHaveBeenCalledWith(
      expect.stringMatching(/codeql-pack\.yml/),
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).toHaveBeenCalled();
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

    showQuickPickSpy.mockResolvedValueOnce({
      label: "my-extension-pack",
      extensionPack: "my-extension-pack",
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce(undefined);
    showAndLogErrorMessageSpy.mockResolvedValue(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        progress,
        token,
      ),
    ).toEqual(undefined);
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showInputBoxSpy).not.toHaveBeenCalled();
    expect(showAndLogErrorMessageSpy).toHaveBeenCalledTimes(1);
    expect(showAndLogErrorMessageSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Could not parse/),
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).toHaveBeenCalled();
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

    showQuickPickSpy.mockResolvedValueOnce({
      label: "my-extension-pack",
      extensionPack: "my-extension-pack",
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce(undefined);
    showAndLogErrorMessageSpy.mockResolvedValue(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        progress,
        token,
      ),
    ).toEqual(undefined);
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showInputBoxSpy).not.toHaveBeenCalled();
    expect(showAndLogErrorMessageSpy).toHaveBeenCalledTimes(1);
    expect(showAndLogErrorMessageSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Expected 'dataExtensions' to be/),
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).toHaveBeenCalled();
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

    showQuickPickSpy.mockResolvedValueOnce({
      label: "my-extension-pack",
      extensionPack: "my-extension-pack",
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce(undefined);
    showAndLogErrorMessageSpy.mockResolvedValue(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
        progress,
        token,
      ),
    ).toEqual(undefined);
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showInputBoxSpy).not.toHaveBeenCalled();
    expect(showAndLogErrorMessageSpy).toHaveBeenCalledTimes(1);
    expect(showAndLogErrorMessageSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Expected 'dataExtensions' to be/),
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).toHaveBeenCalled();
  });

  it("allows cancelling the new file input box", async () => {
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
        dataExtensions: ["models/**/*.yml"],
      }),
    );

    showQuickPickSpy.mockResolvedValueOnce({
      label: "my-extension-pack",
      extensionPack: "my-extension-pack",
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce(undefined);
    showInputBoxSpy.mockResolvedValue(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
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
      path: "/a/b/c",
    } as QuickPickItem);
    showInputBoxSpy.mockResolvedValue(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
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
      "Invalid package name: a pack name must contain only lowercase ASCII letters, ASCII digits, and hyphens",
    );
    expect(await validateFile("github/vscode-codeql-")).toEqual(
      "Invalid package name: a pack name must contain only lowercase ASCII letters, ASCII digits, and hyphens",
    );
    expect(
      await validateFile("github/vscode-codeql-extensions"),
    ).toBeUndefined();
    expect(await validateFile("vscode-codeql-extensions")).toBeUndefined();
  });

  it("validates the file input", async () => {
    const tmpDir = await dir({
      unsafeCleanup: true,
    });

    const cliServer = mockCliServer(
      {
        "my-extension-pack": [tmpDir.path],
      },
      { models: [], data: {} },
    );

    const qlpackPath = join(tmpDir.path, "codeql-pack.yml");
    await outputFile(
      qlpackPath,
      dumpYaml({
        name: "my-extension-pack",
        version: "0.0.0",
        library: true,
        extensionTargets: {
          "codeql/java-all": "*",
        },
        dataExtensions: ["models/**/*.yml", "data/**/*.yml"],
      }),
    );
    await outputFile(
      join(tmpDir.path, "models", "model.yml"),
      dumpYaml({
        extensions: [],
      }),
    );

    showQuickPickSpy.mockResolvedValueOnce({
      label: "my-extension-pack",
      extensionPack: "my-extension-pack",
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce(undefined);
    showInputBoxSpy.mockResolvedValue(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
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
      `File must match one of the patterns in 'dataExtensions' in ${qlpackPath}`,
    );
    expect(await validateFile("models/model.yaml")).toEqual(
      `File must match one of the patterns in 'dataExtensions' in ${qlpackPath}`,
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
        "my-extension-pack": [tmpDir.path],
      },
      { models: [], data: {} },
    );

    const qlpackPath = join(tmpDir.path, "codeql-pack.yml");
    await outputFile(
      qlpackPath,
      dumpYaml({
        name: "my-extension-pack",
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
      label: "my-extension-pack",
      extensionPack: "my-extension-pack",
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce(undefined);
    showInputBoxSpy.mockResolvedValue(undefined);

    expect(
      await pickExtensionPackModelFile(
        cliServer,
        databaseItem,
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
