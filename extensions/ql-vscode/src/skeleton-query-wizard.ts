import { join } from "path";
import { CancellationToken, Uri, workspace, window as Window } from "vscode";
import { CodeQLCliServer } from "./cli";
import { OutputChannelLogger } from "./common";
import { Credentials } from "./common/authentication";
import { QueryLanguage } from "./common/query-language";
import {
  askForLanguage,
  getFirstWorkspaceFolder,
  isFolderAlreadyInWorkspace,
} from "./helpers";
import { getErrorMessage } from "./pure/helpers-pure";
import { QlPackGenerator } from "./qlpack-generator";
import { DatabaseItem, DatabaseManager } from "./local-databases";
import { ProgressCallback, UserCancellationException } from "./progress";
import { askForGitHubRepo, downloadGitHubDatabase } from "./databaseFetcher";
import { existsSync } from "fs";

type QueryLanguagesToDatabaseMap = Record<string, string>;

export const QUERY_LANGUAGE_TO_DATABASE_REPO: QueryLanguagesToDatabaseMap = {
  cpp: "google/brotli",
  csharp: "restsharp/RestSharp",
  go: "spf13/cobra",
  java: "projectlombok/lombok",
  javascript: "d3/d3",
  python: "pallets/flask",
  ruby: "jekyll/jekyll",
  swift: "Alamofire/Alamofire",
};

export class SkeletonQueryWizard {
  private language: string | undefined;
  private fileName = "example.ql";
  private qlPackStoragePath: string | undefined;

  constructor(
    private readonly cliServer: CodeQLCliServer,
    private readonly progress: ProgressCallback,
    private readonly credentials: Credentials | undefined,
    private readonly extLogger: OutputChannelLogger,
    private readonly databaseManager: DatabaseManager,
    private readonly token: CancellationToken,
    private readonly databaseStoragePath: string | undefined,
  ) {}

  private get folderName() {
    return `codeql-custom-queries-${this.language}`;
  }

  public async execute() {
    // show quick pick to choose language
    this.language = await this.chooseLanguage();
    if (!this.language) {
      return;
    }

    this.qlPackStoragePath = getFirstWorkspaceFolder();

    const skeletonPackAlreadyExists =
      existsSync(join(this.qlPackStoragePath, this.folderName)) ||
      isFolderAlreadyInWorkspace(this.folderName);

    if (skeletonPackAlreadyExists) {
      // just create a new example query file in skeleton QL pack
      await this.createExampleFile();
      // select existing database for language
      await this.selectExistingDatabase();
    } else {
      // generate a new skeleton QL pack with query file
      await this.createQlPack();
      // download database based on language and select it
      await this.downloadDatabase();
    }

    // open a query file

    try {
      await this.openExampleFile();
    } catch (e: unknown) {
      void this.extLogger.log(
        `Could not open example query file: ${getErrorMessage(e)}`,
      );
    }
  }

  private async openExampleFile() {
    if (this.folderName === undefined || this.qlPackStoragePath === undefined) {
      throw new Error("Path to folder is undefined");
    }

    const queryFileUri = Uri.file(
      join(this.qlPackStoragePath, this.folderName, this.fileName),
    );

    void workspace.openTextDocument(queryFileUri).then((doc) => {
      void Window.showTextDocument(doc);
    });
  }

  private async chooseLanguage() {
    this.progress({
      message: "Choose language",
      step: 1,
      maxStep: 3,
    });

    return await askForLanguage(this.cliServer, false);
  }

  private async createQlPack() {
    if (this.folderName === undefined) {
      throw new Error("Folder name is undefined");
    }

    this.progress({
      message: "Creating skeleton QL pack around query",
      step: 2,
      maxStep: 3,
    });

    try {
      const qlPackGenerator = new QlPackGenerator(
        this.folderName,
        this.language as QueryLanguage,
        this.cliServer,
        this.qlPackStoragePath,
      );

      await qlPackGenerator.generate();
    } catch (e: unknown) {
      void this.extLogger.log(
        `Could not create skeleton QL pack: ${getErrorMessage(e)}`,
      );
    }
  }

  private async createExampleFile() {
    if (this.folderName === undefined) {
      throw new Error("Folder name is undefined");
    }

    this.progress({
      message:
        "Skeleton query pack already exists. Creating additional query example file.",
      step: 2,
      maxStep: 3,
    });

    try {
      const qlPackGenerator = new QlPackGenerator(
        this.folderName,
        this.language as QueryLanguage,
        this.cliServer,
        this.qlPackStoragePath,
      );

      this.fileName = await this.determineNextFileName(this.folderName);
      await qlPackGenerator.createExampleQlFile(this.fileName);
    } catch (e: unknown) {
      void this.extLogger.log(
        `Could not create skeleton QL pack: ${getErrorMessage(e)}`,
      );
    }
  }

  private async determineNextFileName(folderName: string): Promise<string> {
    if (this.qlPackStoragePath === undefined) {
      throw new Error("QL Pack storage path is undefined");
    }

    const folderUri = Uri.file(join(this.qlPackStoragePath, folderName));
    const files = await workspace.fs.readDirectory(folderUri);
    const qlFiles = files.filter(([filename, _fileType]) =>
      filename.match(/^example[0-9]*\.ql$/),
    );

    return `example${qlFiles.length + 1}.ql`;
  }

  private async downloadDatabase() {
    if (this.qlPackStoragePath === undefined) {
      throw new Error("QL Pack storage path is undefined");
    }

    if (this.databaseStoragePath === undefined) {
      throw new Error("Database storage path is undefined");
    }

    if (this.language === undefined) {
      throw new Error("Language is undefined");
    }

    this.progress({
      message: "Downloading database",
      step: 3,
      maxStep: 3,
    });

    const githubRepoNwo = QUERY_LANGUAGE_TO_DATABASE_REPO[this.language];
    const chosenRepo = await askForGitHubRepo(undefined, githubRepoNwo);

    if (!chosenRepo) {
      throw new UserCancellationException("No GitHub repository provided");
    }

    await downloadGitHubDatabase(
      chosenRepo,
      this.databaseManager,
      this.databaseStoragePath,
      this.credentials,
      this.progress,
      this.token,
      this.cliServer,
      this.language,
    );
  }

  private async selectExistingDatabase() {
    if (this.language === undefined) {
      throw new Error("Language is undefined");
    }

    if (this.qlPackStoragePath === undefined) {
      throw new Error("QL Pack storage path is undefined");
    }

    const databaseNwo = QUERY_LANGUAGE_TO_DATABASE_REPO[this.language];

    const existingDatabaseItem = await this.findDatabaseItemByNwo(
      this.language,
      databaseNwo,
      this.databaseManager.databaseItems,
    );

    if (existingDatabaseItem) {
      // select the found database
      await this.databaseManager.setCurrentDatabaseItem(existingDatabaseItem);
    } else {
      const sameLanguageDatabaseItem = await this.findDatabaseItemByLanguage(
        this.language,
        this.databaseManager.databaseItems,
      );

      if (sameLanguageDatabaseItem) {
        // select the found database
        await this.databaseManager.setCurrentDatabaseItem(
          sameLanguageDatabaseItem,
        );
      } else {
        // download new database and select it
        await this.downloadDatabase();
      }
    }
  }

  public async findDatabaseItemByNwo(
    language: string,
    databaseNwo: string,
    databaseItems: readonly DatabaseItem[],
  ): Promise<DatabaseItem | undefined> {
    const dbItems = databaseItems || [];
    const dbs = dbItems.filter(
      (db) =>
        db.language === language &&
        db.name === databaseNwo &&
        db.error === undefined,
    );

    if (dbs.length === 0) {
      return undefined;
    }
    return dbs[0];
  }

  public async findDatabaseItemByLanguage(
    language: string,
    databaseItems: readonly DatabaseItem[],
  ): Promise<DatabaseItem | undefined> {
    const dbItems = databaseItems || [];
    const dbs = dbItems.filter(
      (db) => db.language === language && db.error === undefined,
    );
    if (dbs.length === 0) {
      return undefined;
    }
    return dbs[0];
  }
}
