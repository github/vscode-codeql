import * as fetch from "node-fetch";
import * as unzipper from "unzipper";
import { Uri, ProgressOptions, ProgressLocation, commands, window } from "vscode";
import * as fs from "fs-extra";
import * as path from "path";
import { DatabaseManager, DatabaseItem } from "./databases";
import { ProgressCallback, showAndLogErrorMessage, withProgress } from "./helpers";

export default async function promptFetchDatabase(dbm: DatabaseManager, storagePath: string) {
  try {
    const databaseUrl = await window.showInputBox({
      prompt: 'Enter URL of zipfile of database to download'
    });

    if (databaseUrl) {
      validateUrl(databaseUrl);

      const progressOptions: ProgressOptions = {
        location: ProgressLocation.Notification,
        title: 'Adding database from URL',
        cancellable: false,
      };
      await withProgress(progressOptions, async progress => await databaseFetcher(databaseUrl, dbm, storagePath, progress));
      commands.executeCommand('codeQLDatabases.focus');
    }
  } catch (e) {
    showAndLogErrorMessage(e.message);
  }
}

export async function databaseFetcher(
  databaseUrl: string,
  databasesManager: DatabaseManager,
  storagePath: string,
  progressCallback?: ProgressCallback
): Promise<DatabaseItem> {
  progressCallback?.({
    maxStep: 3,
    message: 'Downloading database',
    step: 1
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
    message: 'Opening database',
    step: 3
  });

  const dbPath = await findDirWithFile(unzipPath, '.dbinfo');
  if (dbPath) {
    // might need to upgrade before importing...
    const item = await databasesManager.openDatabase(Uri.parse(dbPath));
    databasesManager.setCurrentDatabaseItem(item);
    return item;
  } else {
    throw new Error('Database not found in archive.');
  }
}

async function getStorageFolder(storagePath: string, urlStr: string) {
  const url = Uri.parse(urlStr);
  let lastName = path.basename(url.path).substring(0, 255);
  if (lastName.endsWith(".zip")) {
    lastName = lastName.substring(0, lastName.length - 4);
  }

  const realpath = await fs.realpath(storagePath);
  let folderName = path.join(realpath, lastName);
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


function validateUrl(databaseUrl: string) {
  let uri;
  try {
    uri = Uri.parse(databaseUrl, true);
  } catch (e) {
    throw new Error(`Invalid url: ${databaseUrl}`);
  }

  if (uri.scheme !== 'https') {
    throw new Error('Must use https for downloading a database.');
  }
}

async function readAndUnzip(databaseUrl: string, unzipPath: string) {
  const unzipStream = unzipper.Extract({
    path: unzipPath,
    verbose: true
  });

  await new Promise((resolve, reject) => {
    // we already know this is a file scheme
    const databaseFile = Uri.parse(databaseUrl).path;
    const stream = fs.createReadStream(databaseFile);
    stream.on('error', reject);
    unzipStream.on('error', reject);
    unzipStream.on('close', resolve);
    stream.pipe(unzipStream);
  });
}

async function fetchAndUnzip(databaseUrl: string, unzipPath: string, progressCallback?: ProgressCallback) {
  const response = await fetch.default(databaseUrl);
  const unzipStream = unzipper.Extract({
    path: unzipPath
  });
  progressCallback?.({
    maxStep: 3,
    message: 'Unzipping database',
    step: 2
  });
  await new Promise((resolve, reject) => {
    response.body.on('error', reject);
    unzipStream.on('error', reject);
    unzipStream.on('close', resolve);
    response.body.pipe(unzipStream);
  });
}

function isFile(databaseUrl: string) {
  return Uri.parse(databaseUrl).scheme === 'file';
}

/**
 * Recursively looks for a file in a directory. If the file exists, then returns the directory containing the file.
 *
 * @param dir The directory to search
 * @param toFind The file to recursively look for in this directory
 *
 * @returns the directory containing the file, or undefined if not found.
 */
async function findDirWithFile(dir: string, toFind: string): Promise<string | undefined> {
  if (!(await fs.stat(dir)).isDirectory()) {
    return;
  }
  const files = await fs.readdir(dir);
  if (files.includes(toFind)) {
    return dir;
  }
  for (const file of files) {
    const newPath = path.join(dir, file);
    const result = await findDirWithFile(newPath, toFind);
    if (result) {
      return result;
    }
  }
  return;
}
