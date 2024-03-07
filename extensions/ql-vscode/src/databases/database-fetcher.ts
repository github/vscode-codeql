import type { Response } from "node-fetch";
import fetch, { AbortError } from "node-fetch";
import { zip } from "zip-a-folder";
import type { InputBoxOptions } from "vscode";
import { Uri, window } from "vscode";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import {
  ensureDir,
  realpath as fs_realpath,
  pathExists,
  createWriteStream,
  remove,
  readdir,
} from "fs-extra";
import { basename, join } from "path";
import type { Octokit } from "@octokit/rest";
import { nanoid } from "nanoid";

import type { DatabaseManager, DatabaseItem } from "./local-databases";
import { tmpDir } from "../tmp-dir";
import type { ProgressCallback } from "../common/vscode/progress";
import { reportStreamProgress } from "../common/vscode/progress";
import { extLogger } from "../common/logging/vscode";
import { getErrorMessage } from "../common/helpers-pure";
import {
  getNwoFromGitHubUrl,
  isValidGitHubNwo,
} from "../common/github-url-identifier-helper";
import {
  addDatabaseSourceToWorkspace,
  allowHttp,
  downloadTimeout,
  isCanary,
} from "../config";
import { showAndLogInformationMessage } from "../common/logging";
import { AppOctokit } from "../common/octokit";
import type { DatabaseOrigin } from "./local-databases/database-origin";
import { createTimeoutSignal } from "../common/fetch-stream";
import type { App } from "../common/app";
import { createFilenameFromString } from "../common/filenames";
import { findDirWithFile } from "../common/files";
import { convertGithubNwoToDatabaseUrl } from "./github-databases/api";

// The number of tries to use when generating a unique filename before
// giving up and using a nanoid.
const DUPLICATE_FILENAMES_TRIES = 10_000;

export class DatabaseFetcher {
  /**
   * @param app the App
   * @param databaseManager the DatabaseManager
   * @param storagePath where to store the unzipped database.
   * @param cli the CodeQL CLI server
   **/
  constructor(
    private readonly app: App,
    private readonly databaseManager: DatabaseManager,
    private readonly storagePath: string,
    private readonly cli: CodeQLCliServer,
  ) {}

  /**
   * Prompts a user to fetch a database from a remote location. Database is assumed to be an archive file.
   */
  public async promptImportInternetDatabase(
    progress: ProgressCallback,
  ): Promise<DatabaseItem | undefined> {
    const databaseUrl = await window.showInputBox({
      prompt: "Enter URL of zipfile of database to download",
    });
    if (!databaseUrl) {
      return;
    }

    this.validateUrl(databaseUrl);

    const item = await this.databaseArchiveFetcher(
      databaseUrl,
      {},
      undefined,
      {
        type: "url",
        url: databaseUrl,
      },
      progress,
    );

    if (item) {
      await this.app.commands.execute("codeQLDatabases.focus");
      void showAndLogInformationMessage(
        extLogger,
        "Database downloaded and imported successfully.",
      );
    }
    return item;
  }

  /**
   * Prompts a user to fetch a database from GitHub.
   * User enters a GitHub repository and then the user is asked which language
   * to download (if there is more than one)
   *
   * @param progress the progress callback
   * @param language the language to download. If undefined, the user will be prompted to choose a language.
   * @param makeSelected make the new database selected in the databases panel (default: true)
   * @param addSourceArchiveFolder whether to add a workspace folder containing the source archive to the workspace
   */
  public async promptImportGithubDatabase(
    progress: ProgressCallback,
    language?: string,
    suggestedRepoNwo?: string,
    makeSelected = true,
    addSourceArchiveFolder = addDatabaseSourceToWorkspace(),
  ): Promise<DatabaseItem | undefined> {
    const githubRepo = await this.askForGitHubRepo(progress, suggestedRepoNwo);
    if (!githubRepo) {
      return;
    }

    const databaseItem = await this.downloadGitHubDatabase(
      githubRepo,
      progress,
      language,
      makeSelected,
      addSourceArchiveFolder,
    );

    if (databaseItem) {
      if (makeSelected) {
        await this.app.commands.execute("codeQLDatabases.focus");
      }
      void showAndLogInformationMessage(
        extLogger,
        "Database downloaded and imported successfully.",
      );
      return databaseItem;
    }

    return;
  }

  private async askForGitHubRepo(
    progress?: ProgressCallback,
    suggestedValue?: string,
  ): Promise<string | undefined> {
    progress?.({
      message: "Choose repository",
      step: 1,
      maxStep: 2,
    });

    const options: InputBoxOptions = {
      title:
        'Enter a GitHub repository URL or "name with owner" (e.g. https://github.com/github/codeql or github/codeql)',
      placeHolder: "https://github.com/<owner>/<repo> or <owner>/<repo>",
      ignoreFocusOut: true,
    };

    if (suggestedValue) {
      options.value = suggestedValue;
    }

    return await window.showInputBox(options);
  }

  /**
   * Downloads a database from GitHub
   *
   * @param githubRepo the GitHub repository to download the database from
   * @param progress the progress callback
   * @param language the language to download. If undefined, the user will be prompted to choose a language.
   * @param makeSelected make the new database selected in the databases panel (default: true)
   * @param addSourceArchiveFolder whether to add a workspace folder containing the source archive to the workspace
   **/
  private async downloadGitHubDatabase(
    githubRepo: string,
    progress: ProgressCallback,
    language?: string,
    makeSelected = true,
    addSourceArchiveFolder = addDatabaseSourceToWorkspace(),
  ): Promise<DatabaseItem | undefined> {
    const nwo = getNwoFromGitHubUrl(githubRepo) || githubRepo;
    if (!isValidGitHubNwo(nwo)) {
      throw new Error(`Invalid GitHub repository: ${githubRepo}`);
    }

    const credentials = isCanary() ? this.app.credentials : undefined;

    const octokit = credentials
      ? await credentials.getOctokit()
      : new AppOctokit();

    const result = await convertGithubNwoToDatabaseUrl(
      nwo,
      octokit,
      progress,
      language,
    );
    if (!result) {
      return;
    }

    const {
      databaseUrl,
      name,
      owner,
      databaseId,
      databaseCreatedAt,
      commitOid,
    } = result;

    return this.downloadGitHubDatabaseFromUrl(
      databaseUrl,
      databaseId,
      databaseCreatedAt,
      commitOid,
      owner,
      name,
      octokit,
      progress,
      makeSelected,
      addSourceArchiveFolder,
    );
  }

  public async downloadGitHubDatabaseFromUrl(
    databaseUrl: string,
    databaseId: number,
    databaseCreatedAt: string,
    commitOid: string | null,
    owner: string,
    name: string,
    octokit: Octokit,
    progress: ProgressCallback,
    makeSelected = true,
    addSourceArchiveFolder = true,
  ): Promise<DatabaseItem | undefined> {
    /**
     * The 'token' property of the token object returned by `octokit.auth()`.
     * The object is undocumented, but looks something like this:
     * {
     *   token: 'xxxx',
     *   tokenType: 'oauth',
     *   type: 'token',
     * }
     * We only need the actual token string.
     */
    const octokitToken = ((await octokit.auth()) as { token: string })?.token;
    return await this.databaseArchiveFetcher(
      databaseUrl,
      {
        Accept: "application/zip",
        Authorization: octokitToken ? `Bearer ${octokitToken}` : "",
      },
      `${owner}/${name}`,
      {
        type: "github",
        repository: `${owner}/${name}`,
        databaseId,
        databaseCreatedAt,
        commitOid,
      },
      progress,
      makeSelected,
      addSourceArchiveFolder,
    );
  }

  /**
   * Imports a database from a local archive.
   *
   * @param databaseUrl the file url of the archive to import
   */
  public async importArchiveDatabase(
    databaseUrl: string,
    progress: ProgressCallback,
  ): Promise<DatabaseItem | undefined> {
    try {
      const item = await this.databaseArchiveFetcher(
        databaseUrl,
        {},
        undefined,
        {
          type: "archive",
          path: databaseUrl,
        },
        progress,
      );
      if (item) {
        await this.app.commands.execute("codeQLDatabases.focus");
        void showAndLogInformationMessage(
          extLogger,
          "Database unzipped and imported successfully.",
        );
      }
      return item;
    } catch (e) {
      if (getErrorMessage(e).includes("unexpected end of file")) {
        throw new Error(
          "Database is corrupt or too large. Try unzipping outside of VS Code and importing the unzipped folder instead.",
        );
      } else {
        // delegate
        throw e;
      }
    }
  }

  /**
   * Fetches an archive database. The database might be on the internet
   * or in the local filesystem.
   *
   * @param databaseUrl URL from which to grab the database
   * @param requestHeaders Headers to send with the request
   * @param nameOverride a name for the database that overrides the default
   * @param origin the origin of the database
   * @param progress callback to send progress messages to
   * @param makeSelected make the new database selected in the databases panel (default: true)
   * @param addSourceArchiveFolder whether to add a workspace folder containing the source archive to the workspace
   */
  private async databaseArchiveFetcher(
    databaseUrl: string,
    requestHeaders: { [key: string]: string },
    nameOverride: string | undefined,
    origin: DatabaseOrigin,
    progress: ProgressCallback,
    makeSelected = true,
    addSourceArchiveFolder = addDatabaseSourceToWorkspace(),
  ): Promise<DatabaseItem> {
    progress({
      message: "Getting database",
      step: 1,
      maxStep: 4,
    });
    if (!this.storagePath) {
      throw new Error("No storage path specified.");
    }
    await ensureDir(this.storagePath);
    const unzipPath = await this.getStorageFolder(databaseUrl, nameOverride);

    if (Uri.parse(databaseUrl).scheme === "file") {
      await this.readAndUnzip(databaseUrl, unzipPath, progress);
    } else {
      await this.fetchAndUnzip(
        databaseUrl,
        requestHeaders,
        unzipPath,
        progress,
      );
    }

    progress({
      message: "Opening database",
      step: 3,
      maxStep: 4,
    });

    // find the path to the database. The actual database might be in a sub-folder
    const dbPath = await findDirWithFile(
      unzipPath,
      ".dbinfo",
      "codeql-database.yml",
    );
    if (dbPath) {
      progress({
        message: "Validating and fixing source location",
        step: 4,
        maxStep: 4,
      });
      await this.ensureZippedSourceLocation(dbPath);

      const item = await this.databaseManager.openDatabase(
        Uri.file(dbPath),
        origin,
        makeSelected,
        nameOverride,
        {
          addSourceArchiveFolder,
          extensionManagedLocation: unzipPath,
        },
      );
      return item;
    } else {
      throw new Error("Database not found in archive.");
    }
  }

  private async getStorageFolder(urlStr: string, nameOverrride?: string) {
    let lastName: string;

    if (nameOverrride) {
      lastName = createFilenameFromString(nameOverrride);
    } else {
      // we need to generate a folder name for the unzipped archive,
      // this needs to be human readable since we may use this name as the initial
      // name for the database
      const url = Uri.parse(urlStr);
      // MacOS has a max filename length of 255
      // and remove a few extra chars in case we need to add a counter at the end.
      lastName = basename(url.path).substring(0, 250);
      if (lastName.endsWith(".zip")) {
        lastName = lastName.substring(0, lastName.length - 4);
      }
    }

    const realpath = await fs_realpath(this.storagePath);
    let folderName = lastName;

    // get all existing files instead of calling pathExists on every
    // single combination of realpath and folderName
    const existingFiles = await readdir(realpath);

    // avoid overwriting existing folders
    let counter = 0;
    while (existingFiles.includes(basename(folderName))) {
      counter++;

      if (counter <= DUPLICATE_FILENAMES_TRIES) {
        // First try to use a counter to make the name unique.
        folderName = `${lastName}-${counter}`;
      } else if (counter <= DUPLICATE_FILENAMES_TRIES + 5) {
        // If there are more than 10,000 similarly named databases,
        // give up on using a counter and use a random string instead.
        folderName = `${lastName}-${nanoid()}`;
      } else {
        // This should almost never happen, but just in case, we don't want to
        // get stuck in an infinite loop.
        throw new Error(
          "Could not find a unique name for downloaded database. Please remove some databases and try again.",
        );
      }
    }
    return join(realpath, folderName);
  }

  private validateUrl(databaseUrl: string) {
    let uri;
    try {
      uri = Uri.parse(databaseUrl, true);
    } catch (e) {
      throw new Error(`Invalid url: ${databaseUrl}`);
    }

    if (!allowHttp() && uri.scheme !== "https") {
      throw new Error("Must use https for downloading a database.");
    }
  }

  private async readAndUnzip(
    zipUrl: string,
    unzipPath: string,
    progress?: ProgressCallback,
  ) {
    const zipFile = Uri.parse(zipUrl).fsPath;
    progress?.({
      maxStep: 10,
      step: 9,
      message: `Unzipping into ${basename(unzipPath)}`,
    });

    await this.cli.databaseUnbundle(zipFile, unzipPath);
  }

  private async fetchAndUnzip(
    databaseUrl: string,
    requestHeaders: { [key: string]: string },
    unzipPath: string,
    progress?: ProgressCallback,
  ) {
    // Although it is possible to download and stream directly to an unzipped directory,
    // we need to avoid this for two reasons. The central directory is located at the
    // end of the zip file. It is the source of truth of the content locations. Individual
    // file headers may be incorrect. Additionally, saving to file first will reduce memory
    // pressure compared with unzipping while downloading the archive.

    const archivePath = join(tmpDir.name, `archive-${Date.now()}.zip`);

    progress?.({
      maxStep: 3,
      message: "Downloading database",
      step: 1,
    });

    const {
      signal,
      onData,
      dispose: disposeTimeout,
    } = createTimeoutSignal(downloadTimeout());

    let response: Response;
    try {
      response = await this.checkForFailingResponse(
        await fetch(databaseUrl, {
          headers: requestHeaders,
          signal,
        }),
        "Error downloading database",
      );
    } catch (e) {
      disposeTimeout();

      if (e instanceof AbortError) {
        const thrownError = new AbortError("The request timed out.");
        thrownError.stack = e.stack;
        throw thrownError;
      }

      throw e;
    }

    const archiveFileStream = createWriteStream(archivePath);

    const contentLength = response.headers.get("content-length");
    const totalNumBytes = contentLength
      ? parseInt(contentLength, 10)
      : undefined;
    reportStreamProgress(
      response.body,
      "Downloading database",
      totalNumBytes,
      progress,
    );

    response.body.on("data", onData);

    try {
      await new Promise((resolve, reject) => {
        response.body
          .pipe(archiveFileStream)
          .on("finish", resolve)
          .on("error", reject);

        // If an error occurs on the body, we also want to reject the promise (e.g. during a timeout error).
        response.body.on("error", reject);
      });
    } catch (e) {
      // Close and remove the file if an error occurs
      archiveFileStream.close(() => {
        void remove(archivePath);
      });

      if (e instanceof AbortError) {
        const thrownError = new AbortError("The download timed out.");
        thrownError.stack = e.stack;
        throw thrownError;
      }

      throw e;
    } finally {
      disposeTimeout();
    }

    await this.readAndUnzip(
      Uri.file(archivePath).toString(true),
      unzipPath,
      progress,
    );

    // remove archivePath eagerly since these archives can be large.
    await remove(archivePath);
  }

  private async checkForFailingResponse(
    response: Response,
    errorMessage: string,
  ): Promise<Response | never> {
    if (response.ok) {
      return response;
    }

    // An error downloading the database. Attempt to extract the reason behind it.
    const text = await response.text();
    let msg: string;
    try {
      const obj = JSON.parse(text);
      msg =
        obj.error || obj.message || obj.reason || JSON.stringify(obj, null, 2);
    } catch (e) {
      msg = text;
    }
    throw new Error(`${errorMessage}.\n\nReason: ${msg}`);
  }

  /**
   * Databases created by the old odasa tool will not have a zipped
   * source location. However, this extension works better if sources
   * are zipped.
   *
   * This function ensures that the source location is zipped. If the
   * `src` folder exists and the `src.zip` file does not, the `src`
   * folder will be zipped and then deleted.
   *
   * @param databasePath The full path to the unzipped database
   */
  private async ensureZippedSourceLocation(
    databasePath: string,
  ): Promise<void> {
    const srcFolderPath = join(databasePath, "src");
    const srcZipPath = `${srcFolderPath}.zip`;

    if ((await pathExists(srcFolderPath)) && !(await pathExists(srcZipPath))) {
      await zip(srcFolderPath, srcZipPath);
      await remove(srcFolderPath);
    }
  }
}
