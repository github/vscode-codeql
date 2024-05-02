import { Uri, workspace } from "vscode";
import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import { getActivatedExtension } from "../../global.helper";
import { mkdirSync, writeFileSync } from "fs";
import {
  listModelFiles,
  loadModeledMethods,
} from "../../../../src/model-editor/modeled-method-fs";
import type { ExtensionPack } from "../../../../src/model-editor/shared/extension-pack";
import { join } from "path";
import { extLogger } from "../../../../src/common/logging/vscode";
import { homedir, tmpdir } from "os";
import { mkdir, rm } from "fs-extra";
import { nanoid } from "nanoid";
import { QueryLanguage } from "../../../../src/common/query-language";

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
  let tmpDirRemoveCallback: (() => Promise<void>) | undefined;
  let workspacePath: string;
  let cli: CodeQLCliServer;

  beforeEach(async () => {
    if (!process.env.TEST_CODEQL_PATH) {
      fail(
        "TEST_CODEQL_PATH environment variable not set. It should point to the absolute path to a checkout of the codeql repository.",
      );
    }

    // On windows, make sure to use a temp directory that isn't an alias and therefore won't be canonicalised by CodeQL.
    // The tmp package doesn't support this, so we have to do it manually.
    // See https://github.com/github/vscode-codeql/pull/2605 for more context.
    const systemTmpDir =
      process.platform === "win32"
        ? join(homedir(), "AppData", "Local", "Temp")
        : tmpdir();
    tmpDir = join(systemTmpDir, `codeql-vscode-test-${nanoid(8)}`);
    await mkdir(tmpDir, { recursive: true });
    tmpDirRemoveCallback = async () => {
      await rm(tmpDir, { recursive: true });
    };

    const workspaceFolder = {
      uri: Uri.file(join(tmpDir, "workspace")),
      name: "workspace",
      index: 0,
    };
    const codeqlWorkspaceFolder = {
      uri: Uri.file(process.env.TEST_CODEQL_PATH),
      name: "ql",
      index: 1,
    };
    workspacePath = workspaceFolder.uri.fsPath;
    mkdirSync(workspacePath);
    jest
      .spyOn(workspace, "workspaceFolders", "get")
      .mockReturnValue([workspaceFolder, codeqlWorkspaceFolder]);

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

  afterEach(async () => {
    await tmpDirRemoveCallback?.();
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
      const extensionPackPath = writeExtensionPackFiles("extension-pack", []);

      const modelFiles = await listModelFiles(extensionPackPath, cli);
      expect(modelFiles).toEqual(new Set());
    });

    it("should find all model files", async () => {
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

    it("should ignore generated models", async () => {
      const extensionPackPath = writeExtensionPackFiles("extension-pack", [
        "library1.model.yml",
        "library2.model.yml",
        "library.model.generated.yml",
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
      const extensionPackPath = writeExtensionPackFiles("extension-pack", [
        "library.model.yml",
      ]);

      const modeledMethods = await loadModeledMethods(
        makeExtensionPack(extensionPackPath),
        QueryLanguage.Java,
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
