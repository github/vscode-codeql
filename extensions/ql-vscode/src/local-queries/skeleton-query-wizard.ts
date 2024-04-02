import { dirname, join } from "path";
import { Uri, window, window as Window, workspace } from "vscode";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import { showAndLogExceptionWithTelemetry } from "../common/logging";
import type { QueryLanguage } from "../common/query-language";
import { getLanguageDisplayName } from "../common/query-language";
import {
  getFirstWorkspaceFolder,
  getOnDiskWorkspaceFolders,
} from "../common/vscode/workspace-folders";
import { asError, getErrorMessage } from "../common/helpers-pure";
import { QlPackGenerator } from "./qlpack-generator";
import type {
  DatabaseItem,
  DatabaseManager,
} from "../databases/local-databases";
import type { ProgressCallback } from "../common/vscode/progress";
import {
  UserCancellationException,
  withProgress,
} from "../common/vscode/progress";
import type { DatabaseFetcher } from "../databases/database-fetcher";
import {
  getQlPackLocation,
  isCodespacesTemplate,
  setQlPackLocation,
} from "../config";
import { lstat, pathExists } from "fs-extra";
import { askForLanguage } from "../codeql-cli/query-language";
import { showInformationMessageWithAction } from "../common/vscode/dialog";
import { redactableError } from "../common/errors";
import type { App } from "../common/app";
import type { QueryTreeViewItem } from "../queries-panel/query-tree-view-item";
import { containsPath, pathsEqual } from "../common/files";
import { getQlPackFilePath } from "../common/ql";
import { getQlPackLanguage } from "../common/qlpack-language";

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
  private queryStoragePath: string | undefined;
  private downloadPromise: Promise<void> | undefined;

  constructor(
    private readonly cliServer: CodeQLCliServer,
    private readonly progress: ProgressCallback,
    private readonly app: App,
    private readonly databaseManager: DatabaseManager,
    private readonly databaseFetcher: DatabaseFetcher,
    private readonly selectedItems: readonly QueryTreeViewItem[],
    private language: QueryLanguage | undefined = undefined,
  ) {}

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
    // First try detecting the language based on the existing qlpacks.
    // This will override the selected language if there is an existing query pack.
    const detectedLanguage = await this.detectLanguage();
    if (detectedLanguage) {
      this.language = detectedLanguage;
    }

    // If no existing qlpack was found, we need to ask the user for the language
    if (!this.language) {
      // show quick pick to choose language
      this.language = await this.chooseLanguage();
    }

    if (!this.language) {
      return;
    }

    let createSkeletonQueryPack: boolean = false;

    if (!this.qlPackStoragePath) {
      // This means no existing qlpack was detected in the selected folder, so we need
      // to find a new location to store the qlpack. This new location could potentially
      // already exist.
      const storagePath = await this.determineStoragePath();
      this.qlPackStoragePath = join(
        storagePath,
        `codeql-custom-queries-${this.language}`,
      );

      // Try to detect if there is already a qlpack in this location. We will assume that
      // the user hasn't changed the language of the qlpack.
      const qlPackPath = await getQlPackFilePath(this.qlPackStoragePath);

      // If we are creating or using a qlpack in the user's selected folder, we will also
      // create the query in that folder
      this.queryStoragePath = this.qlPackStoragePath;

      createSkeletonQueryPack = qlPackPath === undefined;
    } else {
      // A query pack was detected in the selected folder or one of its ancestors, so we
      // directly use the selected folder as the storage path for the query.
      this.queryStoragePath = await this.determineStoragePathFromSelection();
    }

    if (createSkeletonQueryPack) {
      // generate a new skeleton QL pack with query file
      await this.createQlPack();
    } else {
      // just create a new example query file in skeleton QL pack
      await this.createExampleFile();
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
    if (this.queryStoragePath === undefined) {
      throw new Error("Path to folder is undefined");
    }

    const queryFileUri = Uri.file(join(this.queryStoragePath, this.fileName));

    void workspace.openTextDocument(queryFileUri).then((doc) => {
      void Window.showTextDocument(doc, {
        preview: false,
      });
    });
  }

  public async determineStoragePath(): Promise<string> {
    if (this.selectedItems.length === 0) {
      return this.determineRootStoragePath();
    }

    return this.determineStoragePathFromSelection();
  }

  private async determineStoragePathFromSelection(): Promise<string> {
    // Just like VS Code's "New File" command, if the user has selected multiple files/folders in the queries panel,
    // we will create the new file in the same folder as the first selected item.
    // See https://github.com/microsoft/vscode/blob/a8b7239d0311d4915b57c837972baf4b01394491/src/vs/workbench/contrib/files/browser/fileActions.ts#L893-L900
    const selectedItem = this.selectedItems[0];

    const path = selectedItem.path;

    // We use stat to protect against outdated query tree items
    const fileStat = await lstat(path);

    if (fileStat.isDirectory()) {
      return path;
    }

    return dirname(path);
  }

  public async determineRootStoragePath() {
    const firstStorageFolder = getFirstWorkspaceFolder();

    if (isCodespacesTemplate()) {
      return firstStorageFolder;
    }

    let storageFolder = getQlPackLocation();

    if (storageFolder === undefined || !(await pathExists(storageFolder))) {
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

    if (!(await pathExists(storageFolder))) {
      throw new UserCancellationException(
        "Invalid folder. Must be a folder that already exists.",
      );
    }

    await setQlPackLocation(storageFolder);
    return storageFolder;
  }

  private async detectLanguage(): Promise<QueryLanguage | undefined> {
    if (this.selectedItems.length < 1) {
      return undefined;
    }

    this.progress({
      message: "Resolving existing query packs",
      step: 1,
      maxStep: 3,
    });

    const storagePath = await this.determineStoragePathFromSelection();

    const queryPacks = await this.cliServer.resolveQlpacks(
      getOnDiskWorkspaceFolders(),
      false,
      "query",
    );

    const matchingQueryPacks = Object.values(queryPacks)
      .map((paths) => paths.find((path) => containsPath(path, storagePath)))
      .filter((path): path is string => path !== undefined)
      // Find the longest matching path
      .sort((a, b) => b.length - a.length);

    if (matchingQueryPacks.length === 0) {
      return undefined;
    }

    const matchingQueryPackPath = matchingQueryPacks[0];

    const qlPackPath = await getQlPackFilePath(matchingQueryPackPath);
    if (!qlPackPath) {
      return undefined;
    }

    const language = await getQlPackLanguage(qlPackPath);
    if (language) {
      this.qlPackStoragePath = matchingQueryPackPath;
    }

    return language;
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
    this.progress({
      message: "Creating skeleton QL pack around query",
      step: 2,
      maxStep: 3,
    });

    try {
      const qlPackGenerator = this.createQlPackGenerator();

      await qlPackGenerator.generate();
    } catch (e: unknown) {
      void this.app.logger.log(
        `Could not create skeleton QL pack: ${getErrorMessage(e)}`,
      );
    }
  }

  private async createExampleFile() {
    this.progress({
      message:
        "Skeleton query pack already exists. Creating additional query example file.",
      step: 2,
      maxStep: 3,
    });

    try {
      const qlPackGenerator = this.createQlPackGenerator();

      this.fileName = await this.determineNextFileName();
      await qlPackGenerator.createExampleQlFile(this.fileName);
    } catch (e: unknown) {
      void this.app.logger.log(
        `Could not create query example file: ${getErrorMessage(e)}`,
      );
    }
  }

  private async determineNextFileName(): Promise<string> {
    if (this.queryStoragePath === undefined) {
      throw new Error("Query storage path is undefined");
    }

    const folderUri = Uri.file(this.queryStoragePath);
    const files = await workspace.fs.readDirectory(folderUri);
    // If the example.ql file doesn't exist yet, use that name
    if (!files.some(([filename, _fileType]) => filename === this.fileName)) {
      return this.fileName;
    }

    const qlFiles = files.filter(([filename, _fileType]) =>
      filename.match(/^example[0-9]*\.ql$/),
    );

    return `example${qlFiles.length + 1}.ql`;
  }

  private async promptDownloadDatabase() {
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
    if (this.language === undefined) {
      throw new Error("Language is undefined");
    }

    progress({
      message: "Downloading database",
      step: 1,
      maxStep: 2,
    });

    const githubRepoNwo = QUERY_LANGUAGE_TO_DATABASE_REPO[this.language];
    await this.databaseFetcher.promptImportGithubDatabase(
      progress,
      this.language,
      githubRepoNwo,
    );
  }

  private async selectOrDownloadDatabase() {
    if (this.language === undefined) {
      throw new Error("Language is undefined");
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
    if (this.queryStoragePath === undefined) {
      throw new Error("QL Pack storage path is undefined");
    }

    const queryPath = join(this.queryStoragePath, this.fileName);
    const queryPathUri = Uri.file(queryPath);

    const openFileArgs = [queryPathUri.toString(true)];
    const queryString = encodeURI(JSON.stringify(openFileArgs));
    return `[${this.fileName}](command:vscode.open?${queryString})`;
  }

  private createQlPackGenerator() {
    if (this.qlPackStoragePath === undefined) {
      throw new Error("QL pack storage path is undefined");
    }
    if (this.queryStoragePath === undefined) {
      throw new Error("Query storage path is undefined");
    }
    if (this.language === undefined) {
      throw new Error("Language is undefined");
    }

    const parentFolder = dirname(this.qlPackStoragePath);

    // Only include the folder name in the qlpack name if the qlpack is not in the root of the workspace.
    const includeFolderNameInQlpackName = !getOnDiskWorkspaceFolders().some(
      (workspaceFolder) => pathsEqual(workspaceFolder, parentFolder),
    );

    return new QlPackGenerator(
      this.language,
      this.cliServer,
      this.qlPackStoragePath,
      this.queryStoragePath,
      includeFolderNameInQlpackName,
    );
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

    const dbItems =
      await SkeletonQueryWizard.sortDatabaseItemsByDateAdded(databaseItems);

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
