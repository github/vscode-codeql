import fetch from "node-fetch";
import * as unzipper from "unzipper";
import {
  Uri,
  ProgressOptions,
  ProgressLocation,
  commands,
  window,
} from "vscode";
import * as fs from "fs-extra";
import * as path from "path";
import { DatabaseManager, DatabaseItem } from "./databases";
import {
  ProgressCallback,
  showAndLogErrorMessage,
  withProgress,
  showAndLogInformationMessage,
} from "./helpers";

/**
 * Prompts a user to fetch a database from a remote location. Database is assumed to be an archive file.
 *
 * @param databasesManager the DatabaseManager
 * @param storagePath where to store the unzipped database.
 */
export async function promptImportInternetDatabase(
  databasesManager: DatabaseManager,
  storagePath: string
): Promise<DatabaseItem | undefined> {
  let item: DatabaseItem | undefined = undefined;

  try {
    const databaseUrl = await window.showInputBox({
      prompt: "Enter URL of zipfile of database to download",
    });
    if (databaseUrl) {
      validateHttpsUrl(databaseUrl);

      const progressOptions: ProgressOptions = {
        location: ProgressLocation.Notification,
        title: "Adding database from URL",
        cancellable: false,
      };
      await withProgress(
        progressOptions,
        async (progress) =>
          (item = await databaseArchiveFetcher(
            databaseUrl,
            databasesManager,
            storagePath,
            progress
          ))
      );
      commands.executeCommand("codeQLDatabases.focus");
    }
    showAndLogInformationMessage(
      "Database downloaded and imported successfully."
    );
  } catch (e) {
    showAndLogErrorMessage(e.message);
  }

  return item;
}

/**
 * Prompts a user to fetch a database from lgtm.
 * User enters a project url and then the user is asked which language
 * to download (if there is more than one)
 *
 * @param databasesManager the DatabaseManager
 * @param storagePath where to store the unzipped database.
 */
export async function promptImportLgtmDatabase(
  databasesManager: DatabaseManager,
  storagePath: string
): Promise<DatabaseItem | undefined> {
  let item: DatabaseItem | undefined = undefined;

  try {
    const lgtmUrl = await window.showInputBox({
      prompt:
        "Enter the project URL on LGTM (e.g., https://lgtm.com/projects/g/github/codeql)",
    });
    if (looksLikeLgtmUrl(lgtmUrl)) {
      const databaseUrl = await convertToDatabaseUrl(lgtmUrl);
      if (!databaseUrl) {
        return item;
      }
      const progressOptions: ProgressOptions = {
        location: ProgressLocation.Notification,
        title: "Adding database from LGTM",
        cancellable: false,
      };
      await withProgress(
        progressOptions,
        async (progress) =>
          (item = await databaseArchiveFetcher(
            databaseUrl,
            databasesManager,
            storagePath,
            progress
          ))
      );
      commands.executeCommand("codeQLDatabases.focus");
    }
    showAndLogInformationMessage(
      "Database downloaded and imported successfully."
    );
  } catch (e) {
    showAndLogErrorMessage(e.message);
  }

  return item;
}

/**
 * Imports a database from a local archive.
 *
 * @param databaseUrl the file url of the archive to import
 * @param databasesManager the DatabaseManager
 * @param storagePath where to store the unzipped database.
 */
export async function importArchiveDatabase(
  databaseUrl: string,
  databasesManager: DatabaseManager,
  storagePath: string
): Promise<DatabaseItem | undefined> {
  let item: DatabaseItem | undefined = undefined;
  try {
    const progressOptions: ProgressOptions = {
      location: ProgressLocation.Notification,
      title: "Importing database from archive",
      cancellable: false,
    };
    await withProgress(
      progressOptions,
      async (progress) =>
        (item = await databaseArchiveFetcher(
          databaseUrl,
          databasesManager,
          storagePath,
          progress
        ))
    );
    commands.executeCommand("codeQLDatabases.focus");

    showAndLogInformationMessage(
      "Database unzipped and imported successfully."
    );
  } catch (e) {
    showAndLogErrorMessage(e.message);
  }
  return item;
}

/**
 * Fetches an archive database. The database might be on the internet
 * or in the local filesystem.
 *
 * @param databaseUrl URL from which to grab the database
 * @param databasesManager the DatabaseManager
 * @param storagePath where to store the unzipped database.
 * @param progressCallback optional callback to send progress messages to
 */
async function databaseArchiveFetcher(
  databaseUrl: string,
  databasesManager: DatabaseManager,
  storagePath: string,
  progressCallback?: ProgressCallback
): Promise<DatabaseItem> {
  progressCallback?.({
    maxStep: 3,
    message: "Getting database",
    step: 1,
  });
  if (!storagePath) {
    throw new Error("No storage path specified.");
  }
  await fs.ensureDir(storagePath);
  const unzipPath = await getStorageFolder(storagePath, databaseUrl);

  if (isFile(databaseUrl)) {
    await readAndUnzip(databaseUrl, unzipPath);
  } else {
    await fetchAndUnzip(databaseUrl, unzipPath, progressCallback);
  }

  progressCallback?.({
    maxStep: 3,
    message: "Opening database",
    step: 3,
  });

  // find the path to the database. The actual database might be in a sub-folder
  const dbPath = await findDirWithFile(
    unzipPath,
    ".dbinfo",
    "codeql-database.yml"
  );
  if (dbPath) {
    const item = await databasesManager.openDatabase(Uri.file(dbPath));
    databasesManager.setCurrentDatabaseItem(item);
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
  let lastName = path.basename(url.path).substring(0, 250);
  if (lastName.endsWith(".zip")) {
    lastName = lastName.substring(0, lastName.length - 4);
  }

  const realpath = await fs.realpath(storagePath);
  let folderName = path.join(realpath, lastName);

  // avoid overwriting existing folders
  let counter = 0;
  while (await fs.pathExists(folderName)) {
    counter++;
    folderName = path.join(realpath, `${lastName}-${counter}`);
    if (counter > 100) {
      throw new Error("Could not find a unique name for downloaded database.");
    }
  }
  return folderName;
}

function validateHttpsUrl(databaseUrl: string) {
  let uri;
  try {
    uri = Uri.parse(databaseUrl, true);
  } catch (e) {
    throw new Error(`Invalid url: ${databaseUrl}`);
  }

  if (uri.scheme !== "https") {
    throw new Error("Must use https for downloading a database.");
  }
}

async function readAndUnzip(databaseUrl: string, unzipPath: string) {
  const unzipStream = unzipper.Extract({
    path: unzipPath,
  });

  await new Promise((resolve, reject) => {
    // we already know this is a file scheme
    const databaseFile = Uri.parse(databaseUrl).fsPath;
    const stream = fs.createReadStream(databaseFile);
    stream.on("error", reject);
    unzipStream.on("error", reject);
    unzipStream.on("close", resolve);
    stream.pipe(unzipStream);
  });
}

async function fetchAndUnzip(
  databaseUrl: string,
  unzipPath: string,
  progressCallback?: ProgressCallback
) {
  const response = await fetch(databaseUrl);
  const unzipStream = unzipper.Extract({
    path: unzipPath,
  });
  progressCallback?.({
    maxStep: 3,
    message: "Unzipping database",
    step: 2,
  });
  await new Promise((resolve, reject) => {
    response.body.on("error", reject);
    unzipStream.on("error", reject);
    unzipStream.on("close", resolve);
    response.body.pipe(unzipStream);
  });
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
async function findDirWithFile(
  dir: string,
  ...toFind: string[]
): Promise<string | undefined> {
  if (!(await fs.stat(dir)).isDirectory()) {
    return;
  }
  const files = await fs.readdir(dir);
  if (toFind.some((file) => files.includes(file))) {
    return dir;
  }
  for (const file of files) {
    const newPath = path.join(dir, file);
    const result = await findDirWithFile(newPath, ...toFind);
    if (result) {
      return result;
    }
  }
  return;
}

function looksLikeLgtmUrl(lgtmUrl: string | undefined): lgtmUrl is string {
  if (!lgtmUrl) {
    return false;
  }

  const uri = Uri.parse(lgtmUrl, true);
  if (uri.scheme !== "https") {
    return false;
  }

  if (uri.authority !== "lgtm.com" && uri.authority !== "www.lgtm.com") {
    return false;
  }

  const paths = uri.path.split("/").filter((segment) => segment);
  return paths.length === 4 && paths[0] === "projects" && paths[1] === "g";
}

async function convertToDatabaseUrl(lgtmUrl: string) {
  const uri = Uri.parse(lgtmUrl, true);
  const paths = ["api", "v1.0"].concat(
    uri.path.split("/").filter((segment) => segment)
  );
  const projectUrl = `https://lgtm.com/${paths.join("/")}`;
  const projectResponse = await fetch(projectUrl);
  const projectJson = await projectResponse.json();

  const language = await promptForLanguage(projectJson);
  if (!language) {
    return;
  }
  return `https://lgtm.com/${[
    "api",
    "v1.0",
    "snapshots",
    projectJson.id,
    language,
  ].join("/")}`;
}

async function promptForLanguage(
  projectJson: any
): Promise<string | undefined> {
  if (!projectJson?.languages?.length) {
    return;
  }
  if (projectJson.languages.length === 1) {
    return projectJson.languages[0].language;
  }

  return await window.showQuickPick(
    projectJson.languages.map((lang: { language: string }) => lang.language), {
      placeHolder: "Select the database language to download:"
    }
  );
}
