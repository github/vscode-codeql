import * as fetch from "node-fetch";
import * as unzipper from "unzipper";
import { Uri, ProgressOptions, ProgressLocation, commands, window } from "vscode";
import * as fs from "fs-extra";
import * as path from "path";
import { DatabaseManager } from "./databases";
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

async function databaseFetcher(
  databaseUrl: string,
  databasesManager: DatabaseManager,
  storagePath: string,
  progressCallback: ProgressCallback
): Promise<void> {
  progressCallback({
    maxStep: 3,
    message: 'Downloading database',
    step: 1
  });
  if (!storagePath) {
    throw new Error("No storage path specified.");
  }
  const unzipPath = await getStorageFolder(storagePath, databaseUrl);

  const response = await fetch.default(databaseUrl);
  const unzipStream = unzipper.Extract({
    path: unzipPath
  });
  progressCallback({
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
  progressCallback({
    maxStep: 3,
    message: 'Opening database',
    step: 3
  });

  // if there is a single directory inside, then assume that's what we want to import
  const dirs = await fs.readdir(unzipPath);
  const dbPath = dirs?.length === 1 && (await fs.stat(path.join(unzipPath, dirs[0]))).isDirectory
    ? path.join(unzipPath, dirs[0])
    : unzipPath;

  // might need to upgrade before importing...
  const item = await databasesManager.openDatabase(Uri.parse(dbPath));
  databasesManager.setCurrentDatabaseItem(item);
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
