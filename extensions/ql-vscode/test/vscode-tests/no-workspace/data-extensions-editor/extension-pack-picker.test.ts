import { QuickPickItem, window } from "vscode";

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

  const progress = jest.fn();
  let showQuickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;

  beforeEach(() => {
    showQuickPickSpy = jest
      .spyOn(window, "showQuickPick")
      .mockRejectedValue(new Error("Unexpected call to showQuickPick"));
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

    expect(await pickExtensionPackModelFile(cliServer, progress)).toEqual(
      "/a/b/c/my-extension-pack/models/model.yml",
    );
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
    );
    expect(showQuickPickSpy).toHaveBeenCalledWith(
      [
        {
          label: "models/model.yml",
          file: "/a/b/c/my-extension-pack/models/model.yml",
        },
      ],
      {
        title: expect.any(String),
      },
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

    expect(await pickExtensionPackModelFile(cliServer, progress)).toEqual(
      undefined,
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).not.toHaveBeenCalled();
  });

  it("does not show any options when there are no extension packs", async () => {
    const cliServer = mockCliServer({}, { models: [], data: {} });

    showQuickPickSpy.mockResolvedValueOnce(undefined);

    expect(await pickExtensionPackModelFile(cliServer, progress)).toEqual(
      undefined,
    );
    expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
    expect(showQuickPickSpy).toHaveBeenCalledWith([], {
      title: expect.any(String),
    });
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

    expect(await pickExtensionPackModelFile(cliServer, progress)).toEqual(
      undefined,
    );
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

    expect(await pickExtensionPackModelFile(cliServer, progress)).toEqual(
      undefined,
    );
    expect(cliServer.resolveQlpacks).toHaveBeenCalled();
    expect(cliServer.resolveExtensions).toHaveBeenCalled();
  });

  it("does not show any options when there are no model files", async () => {
    const cliServer = mockCliServer(qlPacks, { models: [], data: {} });

    showQuickPickSpy.mockResolvedValueOnce({
      label: "my-extension-pack",
      extensionPack: "my-extension-pack",
    } as QuickPickItem);
    showQuickPickSpy.mockResolvedValueOnce(undefined);

    expect(await pickExtensionPackModelFile(cliServer, progress)).toEqual(
      undefined,
    );
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
    );
    expect(showQuickPickSpy).toHaveBeenCalledWith([], {
      title: expect.any(String),
    });
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
