import { join } from "path";
import { existsSync } from "fs";
import { QlPackGenerator, QueryLanguage } from "../../../src/qlpack-generator";
import { CodeQLCliServer } from "../../../src/cli";
import { isFolderAlreadyInWorkspace } from "../../../src/helpers";
import { workspace } from "vscode";
import { getErrorMessage } from "../../../src/pure/helpers-pure";
import * as tmp from "tmp";

describe("QlPackGenerator", () => {
  let packFolderName: string;
  let packFolderPath: string;
  let qlPackYamlFilePath: string;
  let exampleQlFilePath: string;
  let language: string;
  let generator: QlPackGenerator;
  let packAddSpy: jest.SpyInstance;
  let dir: tmp.DirResult;

  beforeEach(async () => {
    dir = tmp.dirSync();

    language = "ruby";
    packFolderName = `test-ql-pack-${language}`;
    packFolderPath = join(dir.name, packFolderName);

    qlPackYamlFilePath = join(packFolderPath, "qlpack.yml");
    exampleQlFilePath = join(packFolderPath, "example.ql");

    packAddSpy = jest.fn();
    const mockCli = {
      packAdd: packAddSpy,
    } as unknown as CodeQLCliServer;

    generator = new QlPackGenerator(
      packFolderName,
      language as QueryLanguage,
      mockCli,
      dir.name,
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
    expect(isFolderAlreadyInWorkspace(packFolderName)).toBe(false);
    expect(existsSync(qlPackYamlFilePath)).toBe(false);
    expect(existsSync(exampleQlFilePath)).toBe(false);

    await generator.generate();

    expect(isFolderAlreadyInWorkspace(packFolderName)).toBe(true);
    expect(existsSync(qlPackYamlFilePath)).toBe(true);
    expect(existsSync(exampleQlFilePath)).toBe(true);
    expect(packAddSpy).toHaveBeenCalledWith(packFolderPath, language);
  });
});
