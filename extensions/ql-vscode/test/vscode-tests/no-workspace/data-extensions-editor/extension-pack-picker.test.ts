import { CancellationTokenSource, QuickPickItem, window } from "vscode";
import { dump as dumpYaml } from "js-yaml";
import { outputFile } from "fs-extra";
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

  beforeEach(() => {
    showQuickPickSpy = jest
      .spyOn(window, "showQuickPick")
      .mockRejectedValue(new Error("Unexpected call to showQuickPick"));
    showInputBoxSpy = jest
      .spyOn(window, "showInputBox")
      .mockRejectedValue(new Error("Unexpected call to showInputBox"));
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

  it("shows create option when there are no extension packs", async () => {
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
    expect(showQuickPickSpy).toHaveBeenCalledWith(
      [],
      {
        title: expect.any(String),
      },
      token,
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).not.toHaveBeenCalled();
  });

  it("shows an error when an extension pack resolves to more than 1 location", async () => {
    const showAndLogErrorMessageSpy = jest.spyOn(
      helpers,
      "showAndLogErrorMessage",
    );

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
