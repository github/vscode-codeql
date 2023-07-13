import { Uri, workspace } from "vscode";
import * as tmp from "tmp";
import { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import { getActivatedExtension } from "../../global.helper";
import { mkdirSync, writeFileSync } from "fs";
import { listModelFiles } from "../../../../src/data-extensions-editor/modeled-method-fs";
import { join } from "path";

const dummyExtensionPackContents = `
name: dummy/pack
version: 0.0.0
library: true
extensionTargets:
  codeql/java-all: '*'
dataExtensions:
  - models/**/*.yml
`;

const dummyModelContents = `
extensions:
  - addsTo:
      pack: codeql/java-all
      extensible: sourceModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: sinkModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: summaryModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: neutralModel
    data: []
`;

describe("listModelFiles", () => {
  let tmpDir: string;
  let tmpDirRemoveCallback: (() => void) | undefined;
  let workspacePath: string;
  let cli: CodeQLCliServer;

  beforeEach(async () => {
    const t = tmp.dirSync();
    tmpDir = t.name;
    tmpDirRemoveCallback = t.removeCallback;

    const workspaceFolder = {
      uri: Uri.file(join(tmpDir, "workspace")),
      name: "workspace",
      index: 0,
    };
    workspacePath = workspaceFolder.uri.fsPath;
    mkdirSync(workspacePath);
    jest
      .spyOn(workspace, "workspaceFolders", "get")
      .mockReturnValue([workspaceFolder]);

    const extension = await getActivatedExtension();
    cli = extension.cliServer;
  });

  afterEach(() => {
    tmpDirRemoveCallback?.();
  });

  function makeExtensionPack(
    extensionPackName: string,
    modelFileNames: string[],
  ): string {
    const extensionPackPath = join(workspacePath, extensionPackName);
    mkdirSync(extensionPackPath);

    writeFileSync(
      join(extensionPackPath, "codeql-pack.yml"),
      dummyExtensionPackContents,
    );

    mkdirSync(join(extensionPackPath, "models"));
    for (const filename of modelFileNames) {
      writeFileSync(
        join(extensionPackPath, "models", filename),
        dummyModelContents,
      );
    }

    return extensionPackPath;
  }

  it("should return the empty set when the extension pack is empty", async () => {
    const extensionPackPath = makeExtensionPack("extension-pack", []);

    const modelFiles = await listModelFiles(extensionPackPath, cli);
    expect(modelFiles).toEqual(new Set());
  });

  it("should find all model files", async () => {
    const extensionPackPath = makeExtensionPack("extension-pack", [
      "library1.model.yml",
      "library2.model.yml",
    ]);

    const modelFiles = await listModelFiles(extensionPackPath, cli);
    expect(modelFiles).toEqual(
      new Set([
        join(extensionPackPath, "models", "library1.model.yml"),
        join(extensionPackPath, "models", "library2.model.yml"),
      ]),
    );
  });

  it("should ignore model files from other extension packs", async () => {
    const extensionPackPath = makeExtensionPack("extension-pack", [
      "library1.model.yml",
    ]);
    makeExtensionPack("another-extension-pack", ["library2.model.yml"]);

    const modelFiles = await listModelFiles(extensionPackPath, cli);
    expect(modelFiles).toEqual(
      new Set([join(extensionPackPath, "models", "library1.model.yml")]),
    );
  });
});
