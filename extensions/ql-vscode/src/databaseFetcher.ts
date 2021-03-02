import fetch, { Response } from 'node-fetch';
import * as unzipper from 'unzipper';
import { zip } from 'zip-a-folder';
import {
  Uri,
  CancellationToken,
  commands,
  window,
} from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';

import { DatabaseManager, DatabaseItem } from './databases';
import {
  showAndLogInformationMessage,
} from './helpers';
import {
  reportStreamProgress,
  ProgressCallback,
} from './commandRunner';
import { logger } from './logging';
import { tmpDir } from './run-queries';

/**
 * Prompts a user to fetch a database from a remote location. Database is assumed to be an archive file.
 *
 * @param databaseManager the DatabaseManager
 * @param storagePath where to store the unzipped database.
 */
export async function promptImportInternetDatabase(
  databaseManager: DatabaseManager,
  storagePath: string,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<DatabaseItem | undefined> {
  const databaseUrl = await window.showInputBox({
    prompt: 'Enter URL of zipfile of database to download',
  });
  if (!databaseUrl) {
    return;
  }

  validateHttpsUrl(databaseUrl);

  const item = await databaseArchiveFetcher(
    databaseUrl,
    databaseManager,
    storagePath,
    progress,
    token
  );

  if (item) {
    commands.executeCommand('codeQLDatabases.focus');
    showAndLogInformationMessage('Database downloaded and imported successfully.');
  }
  return item;

}

/**
 * Prompts a user to fetch a database from lgtm.
 * User enters a project url and then the user is asked which language
 * to download (if there is more than one)
 *
 * @param databaseManager the DatabaseManager
 * @param storagePath where to store the unzipped database.
 */
export async function promptImportLgtmDatabase(
  databaseManager: DatabaseManager,
  storagePath: string,
  progress: ProgressCallback,
  token: CancellationToken
): Promise<DatabaseItem | undefined> {
  const lgtmUrl = await window.showInputBox({
    prompt:
      'Enter the project slug or URL on LGTM (e.g., g/github/codeql or https://lgtm.com/projects/g/github/codeql)',
  });
  if (!lgtmUrl) {
    return;
  }

  if (looksLikeLgtmUrl(lgtmUrl)) {
    const databaseUrl = await convertToDatabaseUrl(lgtmUrl);
    if (databaseUrl) {
      const item = await databaseArchiveFetcher(
        databaseUrl,
        databaseManager,
        storagePath,
        progress,
        token
      );
      if (item) {
        commands.executeCommand('codeQLDatabases.focus');
        showAndLogInformationMessage('Database downloaded and imported successfully.');
      }
      return item;
    }
  } else {
    throw new Error(`Invalid LGTM URL: ${lgtmUrl}`);
  }
  return;
}

/**
 * Imports a database from a local archive.
 *
 * @param databaseUrl the file url of the archive to import
 * @param databaseManager the DatabaseManager
 * @param storagePath where to store the unzipped database.
 */
export async function importArchiveDatabase(
  databaseUrl: string,
  databaseManager: DatabaseManager,
  storagePath: string,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<DatabaseItem | undefined> {
  try {
    const item = await databaseArchiveFetcher(
      databaseUrl,
      databaseManager,
      storagePath,
      progress,
      token
    );
    if (item) {
      commands.executeCommand('codeQLDatabases.focus');
      showAndLogInformationMessage('Database unzipped and imported successfully.');
    }
    return item;
  } catch (e) {
    if (e.message.includes('unexpected end of file')) {
      throw new Error('Database is corrupt or too large. Try unzipping outside of VS Code and importing the unzipped folder instead.');
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
 * @param databaseManager the DatabaseManager
 * @param storagePath where to store the unzipped database.
 * @param progress callback to send progress messages to
 * @param token cancellation token
 */
async function databaseArchiveFetcher(
  databaseUrl: string,
  databaseManager: DatabaseManager,
  storagePath: string,
  progress: ProgressCallback,
  token: CancellationToken
): Promise<DatabaseItem> {
  progress({
    message: 'Getting database',
    step: 1,
    maxStep: 4,
  });
  if (!storagePath) {
    throw new Error('No storage path specified.');
  }
  await fs.ensureDir(storagePath);
  const unzipPath = await getStorageFolder(storagePath, databaseUrl);

  if (isFile(databaseUrl)) {
    await readAndUnzip(databaseUrl, unzipPath, progress);
  } else {
    await fetchAndUnzip(databaseUrl, unzipPath, progress);
  }

  progress({
    message: 'Opening database',
    step: 3,
    maxStep: 4,
  });

  // find the path to the database. The actual database might be in a sub-folder
  const dbPath = await findDirWithFile(
    unzipPath,
    '.dbinfo',
    'codeql-database.yml'
  );
  if (dbPath) {
    progress({
      message: 'Validating and fixing source location',
      step: 4,
      maxStep: 4,
    });
    await ensureZippedSourceLocation(dbPath);

    const item = await databaseManager.openDatabase(progress, token, Uri.file(dbPath));
    await databaseManager.setCurrentDatabaseItem(item);
    return item;
  } else {
    throw new Error('Database not found in archive.');
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
  if (lastName.endsWith('.zip')) {
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
      throw new Error('Could not find a unique name for downloaded database.');
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

  if (uri.scheme !== 'https') {
    throw new Error('Must use https for downloading a database.');
  }
}

async function readAndUnzip(
  zipUrl: string,
  unzipPath: string,
  progress?: ProgressCallback
) {
  // TODO: Providing progress as the file is unzipped is currently blocked
  // on https://github.com/ZJONSSON/node-unzipper/issues/222
  const zipFile = Uri.parse(zipUrl).fsPath;
  progress?.({
    maxStep: 10,
    step: 9,
    message: `Unzipping into ${path.basename(unzipPath)}`
  });
  // Must get the zip central directory since streaming the
  // zip contents may not have correct local file headers.
  // Instead, we can only rely on the central directory.
  const directory = await unzipper.Open.file(zipFile);
  await directory.extract({ path: unzipPath });
}

async function fetchAndUnzip(
  databaseUrl: string,
  unzipPath: string,
  progress?: ProgressCallback
) {
  // Although it is possible to download and stream directly to an unzipped directory,
  // we need to avoid this for two reasons. The central directory is located at the
  // end of the zip file. It is the source of truth of the content locations. Individual
  // file headers may be incorrect. Additionally, saving to file first will reduce memory
  // pressure compared with unzipping while downloading the archive.

  const archivePath = path.join(tmpDir.name, `archive-${Date.now()}.zip`);

  progress?.({
    maxStep: 3,
    message: 'Downloading database',
    step: 1,
  });

  const response = await checkForFailingResponse(await fetch(databaseUrl));
  const archiveFileStream = fs.createWriteStream(archivePath);

  const contentLength = response.headers.get('content-length');
  const totalNumBytes = contentLength ? parseInt(contentLength, 10) : undefined;
  reportStreamProgress(response.body, 'Downloading database', totalNumBytes, progress);

  await new Promise((resolve, reject) =>
    response.body.pipe(archiveFileStream)
      .on('finish', resolve)
      .on('error', reject)
  );

  await readAndUnzip(Uri.file(archivePath).toString(true), unzipPath, progress);

  // remove archivePath eagerly since these archives can be large.
  await fs.remove(archivePath);
}

async function checkForFailingResponse(response: Response): Promise<Response | never> {
  if (response.ok) {
    return response;
  }

  // An error downloading the database. Attempt to extract the resaon behind it.
  const text = await response.text();
  let msg: string;
  try {
    const obj = JSON.parse(text);
    msg = obj.error || obj.message || obj.reason || JSON.stringify(obj, null, 2);
  } catch (e) {
    msg = text;
  }
  throw new Error(`Error downloading database.\n\nReason: ${msg}`);
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
// exported for testing
export async function findDirWithFile(
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

/**
 * The URL pattern is https://lgtm.com/projects/{provider}/{org}/{name}/{irrelevant-subpages}.
 * There are several possibilities for the provider: in addition to GitHub.com (g),
 * LGTM currently hosts projects from Bitbucket (b), GitLab (gl) and plain git (git).
 *
 * This function accepts any url that matches the pattern above. It also accepts the
 * raw project slug, e.g., `g/myorg/myproject`
 *
 * After the `{provider}/{org}/{name}` path components, there may be the components
 * related to sub pages.
 *
 * @param lgtmUrl The URL to the lgtm project
 *
 * @return true if this looks like an LGTM project url
 */
// exported for testing
export function looksLikeLgtmUrl(lgtmUrl: string | undefined): lgtmUrl is string {
  if (!lgtmUrl) {
    return false;
  }

  if (convertRawLgtmSlug(lgtmUrl)) {
    return true;
  }

  try {
    const uri = Uri.parse(lgtmUrl, true);
    if (uri.scheme !== 'https') {
      return false;
    }

    if (uri.authority !== 'lgtm.com' && uri.authority !== 'www.lgtm.com') {
      return false;
    }

    const paths = uri.path.split('/').filter((segment) => segment);
    return paths.length >= 4 && paths[0] === 'projects';
  } catch (e) {
    return false;
  }
}

function convertRawLgtmSlug(maybeSlug: string): string | undefined {
  if (!maybeSlug) {
    return;
  }
  const segments = maybeSlug.split('/');
  const providers = ['g', 'gl', 'b', 'git'];
  if (segments.length === 3 && providers.includes(segments[0])) {
    return `https://lgtm.com/projects/${maybeSlug}`;
  }
  return;
}

// exported for testing
export async function convertToDatabaseUrl(lgtmUrl: string) {
  try {
    lgtmUrl = convertRawLgtmSlug(lgtmUrl) || lgtmUrl;

    const uri = Uri.parse(lgtmUrl, true);
    const paths = ['api', 'v1.0'].concat(
      uri.path.split('/').filter((segment) => segment)
    ).slice(0, 6);
    const projectUrl = `https://lgtm.com/${paths.join('/')}`;
    const projectResponse = await fetch(projectUrl);
    const projectJson = await projectResponse.json();

    if (projectJson.code === 404) {
      throw new Error();
    }

    const language = await promptForLanguage(projectJson);
    if (!language) {
      return;
    }
    return `https://lgtm.com/${[
      'api',
      'v1.0',
      'snapshots',
      projectJson.id,
      language,
    ].join('/')}`;
  } catch (e) {
    logger.log(`Error: ${e.message}`);
    throw new Error(`Invalid LGTM URL: ${lgtmUrl}`);
  }
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
    placeHolder: 'Select the database language to download:'
  }
  );
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
  const srcFolderPath = path.join(databasePath, 'src');
  const srcZipPath = srcFolderPath + '.zip';

  if ((await fs.pathExists(srcFolderPath)) && !(await fs.pathExists(srcZipPath))) {
    await zip(srcFolderPath, srcZipPath);
    await fs.remove(srcFolderPath);
  }
}
