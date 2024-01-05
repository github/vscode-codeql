import { ensureDir, writeFile } from "fs-extra";
import { dump } from "js-yaml";
import { dirname, join } from "path";
import { Uri } from "vscode";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import type { QueryLanguage } from "../common/query-language";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { basename } from "../common/path";

export class QlPackGenerator {
  private qlpackName: string | undefined;
  private readonly qlpackVersion: string;
  private readonly header: string;
  private readonly qlpackFileName: string;
  private readonly folderUri: Uri;

  constructor(
    private readonly queryLanguage: QueryLanguage,
    private readonly cliServer: CodeQLCliServer,
    private readonly storagePath: string,
    private readonly queryStoragePath: string,
    private readonly includeFolderNameInQlpackName: boolean = false,
  ) {
    this.qlpackVersion = "1.0.0";
    this.header = "# This is an automatically generated file.\n\n";

    this.qlpackFileName = "codeql-pack.yml";
    this.folderUri = Uri.file(this.storagePath);
  }

  public async generate() {
    this.qlpackName = await this.determineQlpackName();

    // create QL pack folder and add to workspace
    await this.createWorkspaceFolder();

    // create codeql-pack.yml
    await this.createQlPackYaml();

    // create example.ql
    await this.createExampleQlFile();

    // create codeql-pack.lock.yml
    await this.createCodeqlPackLockYaml();
  }

  private async determineQlpackName(): Promise<string> {
    let qlpackBaseName = `getting-started/codeql-extra-queries-${this.queryLanguage}`;
    if (this.includeFolderNameInQlpackName) {
      const folderBasename = basename(dirname(this.folderUri.fsPath));
      if (
        folderBasename.includes("codeql") ||
        folderBasename.includes("queries")
      ) {
        // If the user has already included "codeql" or "queries" in the folder name, don't include it twice
        qlpackBaseName = `getting-started/${folderBasename}-${this.queryLanguage}`;
      } else {
        qlpackBaseName = `getting-started/codeql-extra-queries-${folderBasename}-${this.queryLanguage}`;
      }
    }

    const existingQlPacks = await this.cliServer.resolveQlpacks(
      getOnDiskWorkspaceFolders(),
    );
    const existingQlPackNames = Object.keys(existingQlPacks);

    let qlpackName = qlpackBaseName;
    let i = 0;
    while (existingQlPackNames.includes(qlpackName)) {
      i++;

      qlpackName = `${qlpackBaseName}-${i}`;
    }

    return qlpackName;
  }

  private async createWorkspaceFolder() {
    await ensureDir(this.folderUri.fsPath);
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

  public async createExampleQlFile(fileName = "example.ql") {
    const exampleQlFilePath = join(this.queryStoragePath, fileName);

    const exampleQl = `
/**
 * This is an automatically generated file
 * @name Hello world
 * @kind problem
 * @problem.severity warning
 * @id ${this.queryLanguage}/example/hello-world
 */

import ${this.queryLanguage}

from File f
select f, "Hello, world!"
`.trim();

    await writeFile(exampleQlFilePath, exampleQl, "utf8");
  }

  private async createCodeqlPackLockYaml() {
    await this.cliServer.packAdd(this.folderUri.fsPath, this.queryLanguage);
  }
}
