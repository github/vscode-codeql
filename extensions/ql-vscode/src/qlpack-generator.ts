import { writeFile } from "fs-extra";
import { dump } from "js-yaml";
import { join } from "path";
import { Uri, workspace } from "vscode";
import { CodeQLCliServer } from "./cli";
import { QueryLanguage } from "./common/query-language";

export class QlPackGenerator {
  private readonly qlpackName: string;
  private readonly qlpackVersion: string;
  private readonly header: string;
  private readonly qlpackFileName: string;
  private readonly folderUri: Uri;

  constructor(
    private readonly folderName: string,
    private readonly queryLanguage: QueryLanguage,
    private readonly cliServer: CodeQLCliServer,
    private readonly storagePath: string | undefined,
  ) {
    if (this.storagePath === undefined) {
      throw new Error("Workspace storage path is undefined");
    }
    this.qlpackName = `getting-started/codeql-extra-queries-${this.queryLanguage}`;
    this.qlpackVersion = "1.0.0";
    this.header = "# This is an automatically generated file.\n\n";

    this.qlpackFileName = "qlpack.yml";
    this.folderUri = Uri.file(join(this.storagePath, this.folderName));
  }

  public async generate() {
    // create QL pack folder and add to workspace
    await this.createWorkspaceFolder();

    // create qlpack.yml
    await this.createQlPackYaml();

    // create example.ql
    await this.createExampleQlFile();

    // create codeql-pack.lock.yml
    await this.createCodeqlPackLockYaml();
  }

  private async createWorkspaceFolder() {
    await workspace.fs.createDirectory(this.folderUri);

    const end = (workspace.workspaceFolders || []).length;

    workspace.updateWorkspaceFolders(end, 0, {
      name: this.folderName,
      uri: this.folderUri,
    });
  }

  private async createQlPackYaml() {
    const qlPackFilePath = join(this.folderUri.fsPath, this.qlpackFileName);

    const qlPackYml = {
      name: this.qlpackName,
      version: this.qlpackVersion,
      dependencies: {},
    };

    await writeFile(qlPackFilePath, this.header + dump(qlPackYml), "utf8");
  }

  private async createExampleQlFile() {
    const exampleQlFilePath = join(this.folderUri.fsPath, "example.ql");

    const exampleQl = `
/**
 * This is an automatically generated file
 * @name Empty block
 * @kind problem
 * @problem.severity warning
 * @id ${this.queryLanguage}/example/empty-block
 */

import ${this.queryLanguage}

select "Hello, world!"
`.trim();

    await writeFile(exampleQlFilePath, exampleQl, "utf8");
  }

  private async createCodeqlPackLockYaml() {
    await this.cliServer.packAdd(this.folderUri.fsPath, this.queryLanguage);
  }
}
