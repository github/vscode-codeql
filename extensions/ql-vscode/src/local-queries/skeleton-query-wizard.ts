import { join } from "path";
import { Uri, window as Window, window, workspace } from "vscode";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { showAndLogExceptionWithTelemetry } from "../common/logging";
import { Credentials } from "../common/authentication";
import {
  getLanguageDisplayName,
  QueryLanguage,
} from "../common/query-language";
import {
  getFirstWorkspaceFolder,
  isFolderAlreadyInWorkspace,
} from "../common/vscode/workspace-folders";
import { asError, getErrorMessage } from "../common/helpers-pure";
import { QlPackGenerator } from "./qlpack-generator";
import { DatabaseItem, DatabaseManager } from "../databases/local-databases";
import {
  ProgressCallback,
  UserCancellationException,
  withProgress,
} from "../common/vscode/progress";
import {
  askForGitHubRepo,
  downloadGitHubDatabase,
} from "../databases/database-fetcher";
import {
  getQlPackLocation,
  isCodespacesTemplate,
  setQlPackLocation,
} from "../config";
import { existsSync } from "fs-extra";
import { askForLanguage } from "../codeql-cli/query-language";
import { showInformationMessageWithAction } from "../common/vscode/dialog";
import { redactableError } from "../common/errors";
import { App } from "../common/app";

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
  private fileName = "example.ql";
  private qlPackStoragePath: string | undefined;
  private downloadPromise: Promise<void> | undefined;

  constructor(
    private readonly cliServer: CodeQLCliServer,
    private readonly progress: ProgressCallback,
    private readonly credentials: Credentials | undefined,
    private readonly app: App,
    private readonly databaseManager: DatabaseManager,
    private readonly databaseStoragePath: string | undefined,
    private language: QueryLanguage | undefined = undefined,
  ) {}

  private get folderName() {
    return `codeql-custom-queries-${this.language}`;
  }

  /**
   * Wait for the download process to complete by waiting for the user to select
   * either "Download database" or closing the dialog. This is used for testing.
   */
  public async waitForDownload() {
    if (this.downloadPromise) {
      await this.downloadPromise;
    }
  }

  public async execute() {
    if (!this.language) {
      // show quick pick to choose language
      this.language = await this.chooseLanguage();
    }

    if (!this.language) {
      return;
    }

    this.qlPackStoragePath = await this.determineStoragePath();

    const skeletonPackAlreadyExists =
      existsSync(join(this.qlPackStoragePath, this.folderName)) ||
      isFolderAlreadyInWorkspace(this.folderName);

    if (skeletonPackAlreadyExists) {
      // just create a new example query file in skeleton QL pack
      await this.createExampleFile();
    } else {
      // generate a new skeleton QL pack with query file
      await this.createQlPack();
    }

    // open the query file
    try {
      await this.openExampleFile();
    } catch (e: unknown) {
      void this.app.logger.log(
        `Could not open example query file: ${getErrorMessage(e)}`,
      );
    }

    // select existing database for language or download a new one
    await this.selectOrDownloadDatabase();
  }

  private async openExampleFile() {
    if (this.folderName === undefined || this.qlPackStoragePath === undefined) {
      throw new Error("Path to folder is undefined");
    }

    const queryFileUri = Uri.file(
      join(this.qlPackStoragePath, this.folderName, this.fileName),
    );

    void workspace.openTextDocument(queryFileUri).then((doc) => {
      void Window.showTextDocument(doc, {
        preview: false,
      });
    });
  }

  public async determineStoragePath() {
    const firstStorageFolder = getFirstWorkspaceFolder();

    if (isCodespacesTemplate()) {
      return firstStorageFolder;
    }

    let storageFolder = getQlPackLocation();

    if (storageFolder === undefined || !existsSync(storageFolder)) {
      storageFolder = await Window.showInputBox({
        title:
          "Please choose a folder in which to create your new query pack. You can change this in the extension settings.",
        value: firstStorageFolder,
        ignoreFocusOut: true,
      });
    }

    if (storageFolder === undefined) {
      throw new UserCancellationException("No storage folder entered.");
    }

    if (!existsSync(storageFolder)) {
      throw new UserCancellationException(
        "Invalid folder. Must be a folder that already exists.",
      );
    }

    await setQlPackLocation(storageFolder);
    return storageFolder;
  }

  private async chooseLanguage() {
    this.progress({
      message: "Choose language",
      step: 1,
      maxStep: 3,
    });

    return await askForLanguage(this.cliServer, true);
  }

  private async createQlPack() {
    if (this.folderName === undefined) {
      throw new Error("Folder name is undefined");
    }
    if (this.language === undefined) {
      throw new Error("Language is undefined");
    }

    this.progress({
      message: "Creating skeleton QL pack around query",
      step: 2,
      maxStep: 3,
    });

    try {
      const qlPackGenerator = new QlPackGenerator(
        this.folderName,
        this.language,
        this.cliServer,
        this.qlPackStoragePath,
      );

      await qlPackGenerator.generate();
    } catch (e: unknown) {
      void this.app.logger.log(
        `Could not create skeleton QL pack: ${getErrorMessage(e)}`,
      );
    }
  }

  private async createExampleFile() {
    if (this.folderName === undefined) {
      throw new Error("Folder name is undefined");
    }
    if (this.language === undefined) {
      throw new Error("Language is undefined");
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
        this.language,
        this.cliServer,
        this.qlPackStoragePath,
      );

      this.fileName = await this.determineNextFileName(this.folderName);
      await qlPackGenerator.createExampleQlFile(this.fileName);
    } catch (e: unknown) {
      void this.app.logger.log(
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

  private async promptDownloadDatabase() {
    if (this.qlPackStoragePath === undefined) {
      throw new Error("QL Pack storage path is undefined");
    }

    if (this.language === undefined) {
      throw new Error("Language is undefined");
    }

    const openFileLink = this.openFileMarkdownLink;

    const displayLanguage = getLanguageDisplayName(this.language);
    const action = await showInformationMessageWithAction(
      `New CodeQL query for ${displayLanguage} ${openFileLink} created, but no CodeQL databases for ${displayLanguage} were detected in your workspace. Would you like to download a CodeQL database for ${displayLanguage} to analyze with ${openFileLink}?`,
      "Download database",
    );

    if (action) {
      void withProgress(async (progress) => {
        try {
          await this.downloadDatabase(progress);
        } catch (e: unknown) {
          if (e instanceof UserCancellationException) {
            return;
          }

          void showAndLogExceptionWithTelemetry(
            this.app.logger,
            this.app.telemetry,
            redactableError(
              asError(e),
            )`An error occurred while downloading the GitHub repository: ${getErrorMessage(
              e,
            )}`,
          );
        }
      });
    }
  }

  private async downloadDatabase(progress: ProgressCallback) {
    if (this.qlPackStoragePath === undefined) {
      throw new Error("QL Pack storage path is undefined");
    }

    if (this.databaseStoragePath === undefined) {
      throw new Error("Database storage path is undefined");
    }

    if (this.language === undefined) {
      throw new Error("Language is undefined");
    }

    progress({
      message: "Downloading database",
      step: 1,
      maxStep: 2,
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
      progress,
      this.cliServer,
      this.language,
    );
  }

  private async selectOrDownloadDatabase() {
    if (this.language === undefined) {
      throw new Error("Language is undefined");
    }

    if (this.qlPackStoragePath === undefined) {
      throw new Error("QL Pack storage path is undefined");
    }

    const existingDatabaseItem =
      await SkeletonQueryWizard.findExistingDatabaseItem(
        this.language,
        this.databaseManager.databaseItems,
      );

    if (existingDatabaseItem) {
      const openFileLink = this.openFileMarkdownLink;

      if (this.databaseManager.currentDatabaseItem !== existingDatabaseItem) {
        // select the found database
        await this.databaseManager.setCurrentDatabaseItem(existingDatabaseItem);

        const displayLanguage = getLanguageDisplayName(this.language);
        void window.showInformationMessage(
          `New CodeQL query for ${displayLanguage} ${openFileLink} created. We have automatically selected your existing CodeQL ${displayLanguage} database ${existingDatabaseItem.name} for you to analyze with ${openFileLink}.`,
        );
      }
    } else {
      // download new database and select it
      this.downloadPromise = this.promptDownloadDatabase().finally(() => {
        this.downloadPromise = undefined;
      });
    }
  }

  private get openFileMarkdownLink() {
    if (this.qlPackStoragePath === undefined) {
      throw new Error("QL Pack storage path is undefined");
    }

    const queryPath = join(
      this.qlPackStoragePath,
      this.folderName,
      this.fileName,
    );
    const queryPathUri = Uri.file(queryPath);

    const openFileArgs = [queryPathUri.toString(true)];
    const queryString = encodeURI(JSON.stringify(openFileArgs));
    return `[${this.fileName}](command:vscode.open?${queryString})`;
  }

  public static async findDatabaseItemByNwo(
    language: string,
    databaseNwo: string,
    databaseItems: readonly DatabaseItem[],
  ): Promise<DatabaseItem | undefined> {
    const dbs = databaseItems.filter(
      (db) => db.language === language && db.name === databaseNwo,
    );

    return dbs.pop();
  }

  public static async findDatabaseItemByLanguage(
    language: string,
    databaseItems: readonly DatabaseItem[],
  ): Promise<DatabaseItem | undefined> {
    const dbs = databaseItems.filter((db) => db.language === language);

    return dbs.pop();
  }

  public static async findExistingDatabaseItem(
    language: string,
    databaseItems: readonly DatabaseItem[],
  ): Promise<DatabaseItem | undefined> {
    const defaultDatabaseNwo = QUERY_LANGUAGE_TO_DATABASE_REPO[language];

    const dbItems = await SkeletonQueryWizard.sortDatabaseItemsByDateAdded(
      databaseItems,
    );

    const defaultDatabaseItem = await SkeletonQueryWizard.findDatabaseItemByNwo(
      language,
      defaultDatabaseNwo,
      dbItems,
    );

    if (defaultDatabaseItem !== undefined) {
      return defaultDatabaseItem;
    }

    return await SkeletonQueryWizard.findDatabaseItemByLanguage(
      language,
      dbItems,
    );
  }

  public static async sortDatabaseItemsByDateAdded(
    databaseItems: readonly DatabaseItem[],
  ) {
    const validDbItems = databaseItems.filter((db) => db.error === undefined);

    return validDbItems.sort((a, b) => {
      if (a.dateAdded === undefined) {
        return -1;
      }

      if (b.dateAdded === undefined) {
        return 1;
      }

      return a.dateAdded - b.dateAdded;
    });
  }
}
