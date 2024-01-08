import { join } from "path";
import { existsSync } from "fs";
import { QlPackGenerator } from "../../../src/local-queries/qlpack-generator";
import type { QueryLanguage } from "../../../src/common/query-language";
import type { CodeQLCliServer } from "../../../src/codeql-cli/cli";
import { Uri, workspace } from "vscode";
import { getErrorMessage } from "../../../src/common/helpers-pure";
import type { DirResult } from "tmp";
import { dirSync } from "tmp";
import { mockedObject } from "../utils/mocking.helpers";
import { ensureDir, readFile } from "fs-extra";
import { load } from "js-yaml";
import type { QlPackFile } from "../../../src/packaging/qlpack-file";

describe("QlPackGenerator", () => {
  let packFolderPath: string;
  let qlPackYamlFilePath: string;
  let exampleQlFilePath: string;
  let language: string;
  let generator: QlPackGenerator;
  let packAddSpy: jest.MockedFunction<typeof CodeQLCliServer.prototype.packAdd>;
  let resolveQlpacksSpy: jest.MockedFunction<
    typeof CodeQLCliServer.prototype.resolveQlpacks
  >;
  let mockCli: CodeQLCliServer;
  let dir: DirResult;

  beforeEach(async () => {
    dir = dirSync({
      unsafeCleanup: true,
    });

    language = "ruby";
    packFolderPath = Uri.file(
      join(dir.name, `test-ql-pack-${language}`),
    ).fsPath;

    qlPackYamlFilePath = join(packFolderPath, "codeql-pack.yml");
    exampleQlFilePath = join(packFolderPath, "example.ql");

    packAddSpy = jest.fn();
    resolveQlpacksSpy = jest.fn().mockResolvedValue({});
    mockCli = mockedObject<CodeQLCliServer>({
      packAdd: packAddSpy,
      resolveQlpacks: resolveQlpacksSpy,
    });

    generator = new QlPackGenerator(
      language as QueryLanguage,
      mockCli,
      packFolderPath,
      packFolderPath,
    );
  });

  afterEach(async () => {
    try {
      dir.removeCallback();

      const workspaceFolders = workspace.workspaceFolders || [];
      const folderIndex = workspaceFolders.findIndex(
        (workspaceFolder) => workspaceFolder.name === dir.name,
      );

      if (folderIndex !== undefined) {
        workspace.updateWorkspaceFolders(folderIndex, 1);
      }
    } catch (e) {
      console.log(
        `Could not remove folder from workspace: ${getErrorMessage(e)}`,
      );
    }
  });

  it("should generate a QL pack", async () => {
    expect(existsSync(packFolderPath)).toBe(false);
    expect(existsSync(qlPackYamlFilePath)).toBe(false);
    expect(existsSync(exampleQlFilePath)).toBe(false);

    await generator.generate();

    expect(existsSync(packFolderPath)).toBe(true);
    expect(existsSync(qlPackYamlFilePath)).toBe(true);
    expect(existsSync(exampleQlFilePath)).toBe(true);

    expect(packAddSpy).toHaveBeenCalledWith(packFolderPath, language);

    const qlpack = load(
      await readFile(qlPackYamlFilePath, "utf8"),
    ) as QlPackFile;
    expect(qlpack).toEqual(
      expect.objectContaining({
        name: "getting-started/codeql-extra-queries-ruby",
      }),
    );
  });

  describe("when a pack with the same name already exists", () => {
    beforeEach(() => {
      resolveQlpacksSpy.mockResolvedValue({
        "getting-started/codeql-extra-queries-ruby": ["/path/to/pack"],
      });
    });

    it("should change the name of the pack", async () => {
      await generator.generate();

      const qlpack = load(
        await readFile(qlPackYamlFilePath, "utf8"),
      ) as QlPackFile;
      expect(qlpack).toEqual(
        expect.objectContaining({
          name: "getting-started/codeql-extra-queries-ruby-1",
        }),
      );
    });
  });

  describe("when the folder name is included in the pack name", () => {
    beforeEach(async () => {
      const parentFolderPath = join(dir.name, "my-folder");

      packFolderPath = Uri.file(
        join(parentFolderPath, `test-ql-pack-${language}`),
      ).fsPath;
      await ensureDir(parentFolderPath);

      qlPackYamlFilePath = join(packFolderPath, "codeql-pack.yml");
      exampleQlFilePath = join(packFolderPath, "example.ql");

      generator = new QlPackGenerator(
        language as QueryLanguage,
        mockCli,
        packFolderPath,
        packFolderPath,
        true,
      );
    });

    it("should set the name of the pack", async () => {
      await generator.generate();

      const qlpack = load(
        await readFile(qlPackYamlFilePath, "utf8"),
      ) as QlPackFile;
      expect(qlpack).toEqual(
        expect.objectContaining({
          name: "getting-started/codeql-extra-queries-my-folder-ruby",
        }),
      );
    });

    describe("when the folder name includes codeql", () => {
      beforeEach(async () => {
        const parentFolderPath = join(dir.name, "my-codeql");

        packFolderPath = Uri.file(
          join(parentFolderPath, `test-ql-pack-${language}`),
        ).fsPath;
        await ensureDir(parentFolderPath);

        qlPackYamlFilePath = join(packFolderPath, "codeql-pack.yml");
        exampleQlFilePath = join(packFolderPath, "example.ql");

        generator = new QlPackGenerator(
          language as QueryLanguage,
          mockCli,
          packFolderPath,
          packFolderPath,
          true,
        );
      });

      it("should set the name of the pack", async () => {
        await generator.generate();

        const qlpack = load(
          await readFile(qlPackYamlFilePath, "utf8"),
        ) as QlPackFile;
        expect(qlpack).toEqual(
          expect.objectContaining({
            name: "getting-started/my-codeql-ruby",
          }),
        );
      });
    });

    describe("when the folder name includes queries", () => {
      beforeEach(async () => {
        const parentFolderPath = join(dir.name, "my-queries");

        packFolderPath = Uri.file(
          join(parentFolderPath, `test-ql-pack-${language}`),
        ).fsPath;
        await ensureDir(parentFolderPath);

        qlPackYamlFilePath = join(packFolderPath, "codeql-pack.yml");
        exampleQlFilePath = join(packFolderPath, "example.ql");

        generator = new QlPackGenerator(
          language as QueryLanguage,
          mockCli,
          packFolderPath,
          packFolderPath,
          true,
        );
      });

      it("should set the name of the pack", async () => {
        await generator.generate();

        const qlpack = load(
          await readFile(qlPackYamlFilePath, "utf8"),
        ) as QlPackFile;
        expect(qlpack).toEqual(
          expect.objectContaining({
            name: "getting-started/my-queries-ruby",
          }),
        );
      });
    });
  });
});
