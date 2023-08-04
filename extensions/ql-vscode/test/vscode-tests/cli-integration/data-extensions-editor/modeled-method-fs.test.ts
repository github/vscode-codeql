import { Uri, workspace } from "vscode";
import * as tmp from "tmp";
import { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import { getActivatedExtension } from "../../global.helper";
import { mkdirSync, writeFileSync } from "fs";
import {
  listModelFiles,
  loadModeledMethods,
} from "../../../../src/data-extensions-editor/modeled-method-fs";
import { ExtensionPack } from "../../../../src/data-extensions-editor/shared/extension-pack";
import { join } from "path";
import { extLogger } from "../../../../src/common/logging/vscode";
import { homedir } from "os";

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
    data:
      - ["org.eclipse.jetty.server","Server",true,"getConnectors","()","","Argument[this]","sql","manual"]

  - addsTo:
      pack: codeql/java-all
      extensible: summaryModel
    data: []

  - addsTo:
      pack: codeql/java-all
      extensible: neutralModel
    data: []
`;

describe("modeled-method-fs", () => {
  let tmpDir: string;
  let tmpDirRemoveCallback: (() => void) | undefined;
  let workspacePath: string;
  let cli: CodeQLCliServer;

  beforeAll(async () => {
    const extension = await getActivatedExtension();
    cli = extension.cliServer;

    // All transitive dependencies must be available for resolve extensions to succeed.
    const packUsingExtensionsPath = join(
      __dirname,
      "../../..",
      "data-extensions",
      "pack-using-extensions",
    );
    await cli.packInstall(packUsingExtensionsPath);
  });

  beforeEach(async () => {
    // On windows, make sure to use a temp directory that isn't an alias and therefore won't be canonicalised by CodeQL.
    // See https://github.com/github/vscode-codeql/pull/2605 for more context.
    const t = tmp.dirSync({
      dir:
        process.platform === "win32"
          ? join(homedir(), "AppData", "Local", "Temp")
          : undefined,
    });
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

  function writeExtensionPackFiles(
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

  function makeExtensionPack(path: string): ExtensionPack {
    return {
      path,
      yamlPath: path,
      name: "dummy/pack",
      version: "0.0.1",
      language: "java",
      extensionTargets: {},
      dataExtensions: [],
    };
  }

  describe("listModelFiles", () => {
    it("should return the empty set when the extension pack is empty", async () => {
      if (!(await cli.cliConstraints.supportsResolveExtensions())) {
        return;
      }

      const extensionPackPath = writeExtensionPackFiles("extension-pack", []);

      const modelFiles = await listModelFiles(extensionPackPath, cli);
      expect(modelFiles).toEqual(new Set());
    });

    it("should find all model files", async () => {
      if (!(await cli.cliConstraints.supportsResolveExtensions())) {
        return;
      }

      const extensionPackPath = writeExtensionPackFiles("extension-pack", [
        "library1.model.yml",
        "library2.model.yml",
      ]);

      const modelFiles = await listModelFiles(extensionPackPath, cli);
      expect(modelFiles).toEqual(
        new Set([
          join("models", "library1.model.yml"),
          join("models", "library2.model.yml"),
        ]),
      );
    });

    it("should ignore model files from other extension packs", async () => {
      if (!(await cli.cliConstraints.supportsResolveExtensions())) {
        return;
      }

      const extensionPackPath = writeExtensionPackFiles("extension-pack", [
        "library1.model.yml",
      ]);
      writeExtensionPackFiles("another-extension-pack", ["library2.model.yml"]);

      const modelFiles = await listModelFiles(extensionPackPath, cli);
      expect(modelFiles).toEqual(
        new Set([join("models", "library1.model.yml")]),
      );
    });
  });

  describe("loadModeledMethods", () => {
    it("should load modeled methods", async () => {
      if (!(await cli.cliConstraints.supportsResolveExtensions())) {
        return;
      }

      const extensionPackPath = writeExtensionPackFiles("extension-pack", [
        "library.model.yml",
      ]);

      const modeledMethods = await loadModeledMethods(
        makeExtensionPack(extensionPackPath),
        cli,
        extLogger,
      );

      expect(Object.keys(modeledMethods).length).toEqual(1);
      expect(Object.keys(modeledMethods)[0]).toEqual(
        "org.eclipse.jetty.server.Server#getConnectors()",
      );
    });
  });
});
