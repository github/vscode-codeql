import { join } from "path";
import { existsSync } from "fs";
import { QlPackGenerator } from "../../../src/qlpack-generator";
import { QueryLanguage } from "../../../src/common/query-language";
import { CodeQLCliServer } from "../../../src/cli";
import { Uri, workspace } from "vscode";
import { getErrorMessage } from "../../../src/pure/helpers-pure";
import * as tmp from "tmp";
import { mockedObject } from "../utils/mocking.helpers";

describe("QlPackGenerator", () => {
  let packFolderName: string;
  let packFolderPath: string;
  let qlPackYamlFilePath: string;
  let exampleQlFilePath: string;
  let language: string;
  let generator: QlPackGenerator;
  let packAddSpy: jest.Mock<any, []>;
  let dir: tmp.DirResult;

  beforeEach(async () => {
    dir = tmp.dirSync();

    language = "ruby";
    packFolderName = `test-ql-pack-${language}`;
    packFolderPath = Uri.file(join(dir.name, packFolderName)).fsPath;

    qlPackYamlFilePath = join(packFolderPath, "codeql-pack.yml");
    exampleQlFilePath = join(packFolderPath, "example.ql");

    packAddSpy = jest.fn();
    const mockCli = mockedObject<CodeQLCliServer>({
      packAdd: packAddSpy,
    });

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
    expect(existsSync(packFolderPath)).toBe(false);
    expect(existsSync(qlPackYamlFilePath)).toBe(false);
    expect(existsSync(exampleQlFilePath)).toBe(false);

    await generator.generate();

    expect(existsSync(packFolderPath)).toBe(true);
    expect(existsSync(qlPackYamlFilePath)).toBe(true);
    expect(existsSync(exampleQlFilePath)).toBe(true);

    expect(packAddSpy).toHaveBeenCalledWith(packFolderPath, language);
  });
});
