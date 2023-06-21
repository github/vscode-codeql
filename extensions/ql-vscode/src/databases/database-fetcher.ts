import fetch, { Response } from "node-fetch";
import { zip } from "zip-a-folder";
import { Open } from "unzipper";
import { Uri, window, InputBoxOptions } from "vscode";
import { CodeQLCliServer } from "../codeql-cli/cli";
import {
  ensureDir,
  realpath as fs_realpath,
  pathExists,
  createWriteStream,
  remove,
  stat,
  readdir,
} from "fs-extra";
import { basename, join } from "path";
import * as Octokit from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";

import { DatabaseManager, DatabaseItem } from "./local-databases";
import { tmpDir } from "../tmp-dir";
import {
  reportStreamProgress,
  ProgressCallback,
} from "../common/vscode/progress";
import { extLogger } from "../common";
import { getErrorMessage } from "../common/helpers-pure";
import {
  getNwoFromGitHubUrl,
  isValidGitHubNwo,
} from "../common/github-url-identifier-helper";
import { Credentials } from "../common/authentication";
import { AppCommandManager } from "../common/commands";
import { ALLOW_HTTP_SETTING } from "../config";
import { showAndLogInformationMessage } from "../common/logging";

/**
 * Prompts a user to fetch a database from a remote location. Database is assumed to be an archive file.
 *
 * @param databaseManager the DatabaseManager
 * @param storagePath where to store the unzipped database.
 */
export async function promptImportInternetDatabase(
  commandManager: AppCommandManager,
  databaseManager: DatabaseManager,
  storagePath: string,
  progress: ProgressCallback,
  cli?: CodeQLCliServer,
): Promise<DatabaseItem | undefined> {
  const databaseUrl = await window.showInputBox({
    prompt: "Enter URL of zipfile of database to download",
  });
  if (!databaseUrl) {
    return;
  }

  validateUrl(databaseUrl);

  const item = await databaseArchiveFetcher(
    databaseUrl,
    {},
    databaseManager,
    storagePath,
    undefined,
    progress,
    cli,
  );

  if (item) {
    await commandManager.execute("codeQLDatabases.focus");
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
 * @param databaseManager the DatabaseManager
 * @param storagePath where to store the unzipped database.
 * @param credentials the credentials to use to authenticate with GitHub
 * @param progress the progress callback
 * @param cli the CodeQL CLI server
 */
export async function promptImportGithubDatabase(
  commandManager: AppCommandManager,
  databaseManager: DatabaseManager,
  storagePath: string,
  credentials: Credentials | undefined,
  progress: ProgressCallback,
  cli?: CodeQLCliServer,
): Promise<DatabaseItem | undefined> {
  const githubRepo = await askForGitHubRepo(progress);
  if (!githubRepo) {
    return;
  }

  const databaseItem = await downloadGitHubDatabase(
    githubRepo,
    databaseManager,
    storagePath,
    credentials,
    progress,
    cli,
  );

  if (databaseItem) {
    await commandManager.execute("codeQLDatabases.focus");
    void showAndLogInformationMessage(
      extLogger,
      "Database downloaded and imported successfully.",
    );
    return databaseItem;
  }

  return;
}

export async function askForGitHubRepo(
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
 * @param databaseManager the DatabaseManager
 * @param storagePath where to store the unzipped database.
 * @param credentials the credentials to use to authenticate with GitHub
 * @param progress the progress callback
 * @param cli the CodeQL CLI server
 * @param language the language to download. If undefined, the user will be prompted to choose a language.
 **/
export async function downloadGitHubDatabase(
  githubRepo: string,
  databaseManager: DatabaseManager,
  storagePath: string,
  credentials: Credentials | undefined,
  progress: ProgressCallback,
  cli?: CodeQLCliServer,
  language?: string,
): Promise<DatabaseItem | undefined> {
  const nwo = getNwoFromGitHubUrl(githubRepo) || githubRepo;
  if (!isValidGitHubNwo(nwo)) {
    throw new Error(`Invalid GitHub repository: ${githubRepo}`);
  }

  const octokit = credentials
    ? await credentials.getOctokit()
    : new Octokit.Octokit({ retry });

  const result = await convertGithubNwoToDatabaseUrl(
    nwo,
    octokit,
    progress,
    language,
  );
  if (!result) {
    return;
  }

  const { databaseUrl, name, owner } = result;

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
  return await databaseArchiveFetcher(
    databaseUrl,
    {
      Accept: "application/zip",
      Authorization: octokitToken ? `Bearer ${octokitToken}` : "",
    },
    databaseManager,
    storagePath,
    `${owner}/${name}`,
    progress,
    cli,
  );
}

/**
 * Imports a database from a local archive.
 *
 * @param databaseUrl the file url of the archive to import
 * @param databaseManager the DatabaseManager
 * @param storagePath where to store the unzipped database.
 */
export async function importArchiveDatabase(
  commandManager: AppCommandManager,
  databaseUrl: string,
  databaseManager: DatabaseManager,
  storagePath: string,
  progress: ProgressCallback,
  cli?: CodeQLCliServer,
): Promise<DatabaseItem | undefined> {
  try {
    const item = await databaseArchiveFetcher(
      databaseUrl,
      {},
      databaseManager,
      storagePath,
      undefined,
      progress,
      cli,
    );
    if (item) {
      await commandManager.execute("codeQLDatabases.focus");
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
 * @param databaseManager the DatabaseManager
 * @param storagePath where to store the unzipped database.
 * @param nameOverride a name for the database that overrides the default
 * @param progress callback to send progress messages to
 */
async function databaseArchiveFetcher(
  databaseUrl: string,
  requestHeaders: { [key: string]: string },
  databaseManager: DatabaseManager,
  storagePath: string,
  nameOverride: string | undefined,
  progress: ProgressCallback,
  cli?: CodeQLCliServer,
): Promise<DatabaseItem> {
  progress({
    message: "Getting database",
    step: 1,
    maxStep: 4,
  });
  if (!storagePath) {
    throw new Error("No storage path specified.");
  }
  await ensureDir(storagePath);
  const unzipPath = await getStorageFolder(storagePath, databaseUrl);

  if (isFile(databaseUrl)) {
    await readAndUnzip(databaseUrl, unzipPath, cli, progress);
  } else {
    await fetchAndUnzip(databaseUrl, requestHeaders, unzipPath, cli, progress);
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
    await ensureZippedSourceLocation(dbPath);

    const makeSelected = true;

    const item = await databaseManager.openDatabase(
      Uri.file(dbPath),
      makeSelected,
      nameOverride,
    );
    return item;
  } else {
    throw new Error("Database not found in archive.");
  }
}

async function getStorageFolder(storagePath: string, urlStr: string) {
  // we need to generate a folder name for the unzipped archive,
  // this needs to be human readable since we may use this name as the initial
  // name for the database
  const url = Uri.parse(urlStr);
  // MacOS has a max filename length of 255
  // and remove a few extra chars in case we need to add a counter at the end.
  let lastName = basename(url.path).substring(0, 250);
  if (lastName.endsWith(".zip")) {
    lastName = lastName.substring(0, lastName.length - 4);
  }

  const realpath = await fs_realpath(storagePath);
  let folderName = join(realpath, lastName);

  // avoid overwriting existing folders
  let counter = 0;
  while (await pathExists(folderName)) {
    counter++;
    folderName = join(realpath, `${lastName}-${counter}`);
    if (counter > 100) {
      throw new Error("Could not find a unique name for downloaded database.");
    }
  }
  return folderName;
}

function validateUrl(databaseUrl: string) {
  let uri;
  try {
    uri = Uri.parse(databaseUrl, true);
  } catch (e) {
    throw new Error(`Invalid url: ${databaseUrl}`);
  }

  if (!ALLOW_HTTP_SETTING.getValue() && uri.scheme !== "https") {
    throw new Error("Must use https for downloading a database.");
  }
}

async function readAndUnzip(
  zipUrl: string,
  unzipPath: string,
  cli?: CodeQLCliServer,
  progress?: ProgressCallback,
) {
  // TODO: Providing progress as the file is unzipped is currently blocked
  // on https://github.com/ZJONSSON/node-unzipper/issues/222
  const zipFile = Uri.parse(zipUrl).fsPath;
  progress?.({
    maxStep: 10,
    step: 9,
    message: `Unzipping into ${basename(unzipPath)}`,
  });
  if (cli) {
    // Use the `database unbundle` command if the installed cli version supports it
    await cli.databaseUnbundle(zipFile, unzipPath);
  } else {
    // Must get the zip central directory since streaming the
    // zip contents may not have correct local file headers.
    // Instead, we can only rely on the central directory.
    const directory = await Open.file(zipFile);
    await directory.extract({ path: unzipPath });
  }
}

async function fetchAndUnzip(
  databaseUrl: string,
  requestHeaders: { [key: string]: string },
  unzipPath: string,
  cli?: CodeQLCliServer,
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

  const response = await checkForFailingResponse(
    await fetch(databaseUrl, { headers: requestHeaders }),
    "Error downloading database",
  );
  const archiveFileStream = createWriteStream(archivePath);

  const contentLength = response.headers.get("content-length");
  const totalNumBytes = contentLength ? parseInt(contentLength, 10) : undefined;
  reportStreamProgress(
    response.body,
    "Downloading database",
    totalNumBytes,
    progress,
  );

  await new Promise((resolve, reject) =>
    response.body
      .pipe(archiveFileStream)
      .on("finish", resolve)
      .on("error", reject),
  );

  await readAndUnzip(
    Uri.file(archivePath).toString(true),
    unzipPath,
    cli,
    progress,
  );

  // remove archivePath eagerly since these archives can be large.
  await remove(archivePath);
}

async function checkForFailingResponse(
  response: Response,
  errorMessage: string,
): Promise<Response | never> {
  if (response.ok) {
    return response;
  }

  // An error downloading the database. Attempt to extract the resaon behind it.
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

function isFile(databaseUrl: string) {
  return Uri.parse(databaseUrl).scheme === "file";
}

/**
 * Recursively looks for a file in a directory. If the file exists, then returns the directory containing the file.
 *
 * @param dir The directory to search
 * @param toFind The file to recursively look for in this directory
 *
 * @returns the directory containing the file, or undefined if not found.
 */
// exported for testing
export async function findDirWithFile(
  dir: string,
  ...toFind: string[]
): Promise<string | undefined> {
  if (!(await stat(dir)).isDirectory()) {
    return;
  }
  const files = await readdir(dir);
  if (toFind.some((file) => files.includes(file))) {
    return dir;
  }
  for (const file of files) {
    const newPath = join(dir, file);
    const result = await findDirWithFile(newPath, ...toFind);
    if (result) {
      return result;
    }
  }
  return;
}

export async function convertGithubNwoToDatabaseUrl(
  nwo: string,
  octokit: Octokit.Octokit,
  progress: ProgressCallback,
  language?: string,
): Promise<
  | {
      databaseUrl: string;
      owner: string;
      name: string;
    }
  | undefined
> {
  try {
    const [owner, repo] = nwo.split("/");

    const response = await octokit.request(
      "GET /repos/:owner/:repo/code-scanning/codeql/databases",
      { owner, repo },
    );

    const languages = response.data.map((db: any) => db.language);

    if (!language || !languages.includes(language)) {
      language = await promptForLanguage(languages, progress);
      if (!language) {
        return;
      }
    }

    return {
      databaseUrl: `https://api.github.com/repos/${owner}/${repo}/code-scanning/codeql/databases/${language}`,
      owner,
      name: repo,
    };
  } catch (e) {
    void extLogger.log(`Error: ${getErrorMessage(e)}`);
    throw new Error(`Unable to get database for '${nwo}'`);
  }
}

export async function promptForLanguage(
  languages: string[],
  progress: ProgressCallback,
): Promise<string | undefined> {
  progress({
    message: "Choose language",
    step: 2,
    maxStep: 2,
  });
  if (!languages.length) {
    throw new Error("No databases found");
  }
  if (languages.length === 1) {
    return languages[0];
  }

  return await window.showQuickPick(languages, {
    placeHolder: "Select the database language to download:",
    ignoreFocusOut: true,
  });
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
async function ensureZippedSourceLocation(databasePath: string): Promise<void> {
  const srcFolderPath = join(databasePath, "src");
  const srcZipPath = `${srcFolderPath}.zip`;

  if ((await pathExists(srcFolderPath)) && !(await pathExists(srcZipPath))) {
    await zip(srcFolderPath, srcZipPath);
    await remove(srcFolderPath);
  }
}
