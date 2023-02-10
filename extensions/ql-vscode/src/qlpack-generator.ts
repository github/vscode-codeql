import { mkdir, writeFile } from "fs-extra";
import { dump } from "js-yaml";
import { join } from "path";
import { CodeQLCliServer } from "./cli";

export type QueryLanguage =
  | "csharp"
  | "cpp"
  | "go"
  | "java"
  | "javascript"
  | "python"
  | "ruby"
  | "swift";

export class QlPackGenerator {
  private readonly qlpackName: string;
  private readonly qlpackVersion: string;
  private readonly header: string;
  private readonly qlpackFileName: string;

  constructor(
    private readonly folderName: string,
    private readonly queryLanguage: QueryLanguage,
    private readonly cliServer: CodeQLCliServer,
  ) {
    this.qlpackName = `getting-started/codeql-extra-queries-${this.queryLanguage}`;
    this.qlpackVersion = "1.0.0";
    this.header = "# This is an automatically generated file.\n\n";

    this.qlpackFileName = "qlpack.yml";
  }

  public async generate() {
    await mkdir(this.folderName);

    // create qlpack.yml
    await this.createQlPackYaml();

    // create example.ql
    await this.createExampleQlFile();

    // create codeql-pack.lock.yml
    await this.createCodeqlPackLockYaml();
  }

  private async createQlPackYaml() {
    const qlPackFile = join(this.folderName, this.qlpackFileName);

    const qlPackYml = {
      name: this.qlpackName,
      version: this.qlpackVersion,
      dependencies: {
        [`codeql/${this.queryLanguage}-all`]: "*",
      },
    };

    await writeFile(qlPackFile, this.header + dump(qlPackYml), "utf8");
  }

  private async createExampleQlFile() {
    const exampleQlFile = join(this.folderName, "example.ql");

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

    await writeFile(exampleQlFile, exampleQl, "utf8");
  }

  private async createCodeqlPackLockYaml() {
    await this.cliServer.packAdd(this.folderName, this.queryLanguage);
  }
}
