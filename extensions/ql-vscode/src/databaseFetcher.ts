import fetch, { Response } from "node-fetch";
import { zip } from "zip-a-folder";
import { Open } from "unzipper";
import { Uri, CancellationToken, commands, window } from "vscode";
import { CodeQLCliServer } from "./cli";
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

import { DatabaseManager, DatabaseItem } from "./databases";
import { showAndLogInformationMessage, tmpDir } from "./helpers";
import { reportStreamProgress, ProgressCallback } from "./commandRunner";
import { extLogger } from "./common";
import { Credentials } from "./authentication";
import { REPO_REGEX, getErrorMessage } from "./pure/helpers-pure";

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
  cli?: CodeQLCliServer,
): Promise<DatabaseItem | undefined> {
  const databaseUrl = await window.showInputBox({
    prompt: "Enter URL of zipfile of database to download",
  });
  if (!databaseUrl) {
    return;
  }

  validateHttpsUrl(databaseUrl);

  const item = await databaseArchiveFetcher(
    databaseUrl,
    {},
    databaseManager,
    storagePath,
    undefined,
    progress,
    token,
    cli,
  );

  if (item) {
    await commands.executeCommand("codeQLDatabases.focus");
    void showAndLogInformationMessage(
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
 */
export async function promptImportGithubDatabase(
  databaseManager: DatabaseManager,
  storagePath: string,
  credentials: Credentials | undefined,
  progress: ProgressCallback,
  token: CancellationToken,
  cli?: CodeQLCliServer,
): Promise<DatabaseItem | undefined> {
  progress({
    message: "Choose repository",
    step: 1,
    maxStep: 2,
  });
  const githubRepo = await window.showInputBox({
    title:
      'Enter a GitHub repository URL or "name with owner" (e.g. https://github.com/github/codeql or github/codeql)',
    placeHolder: "https://github.com/<owner>/<repo> or <owner>/<repo>",
    ignoreFocusOut: true,
  });
  if (!githubRepo) {
    return;
  }

  if (!looksLikeGithubRepo(githubRepo)) {
    throw new Error(`Invalid GitHub repository: ${githubRepo}`);
  }

  const octokit = credentials
    ? await credentials.getOctokit(true)
    : new Octokit.Octokit({ retry });

  const result = await convertGithubNwoToDatabaseUrl(
    githubRepo,
    octokit,
    progress,
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
  const item = await databaseArchiveFetcher(
    databaseUrl,
    {
      Accept: "application/zip",
      Authorization: octokitToken ? `Bearer ${octokitToken}` : "",
    },
    databaseManager,
    storagePath,
    `${owner}/${name}`,
    progress,
    token,
    cli,
  );
  if (item) {
    await commands.executeCommand("codeQLDatabases.focus");
    void showAndLogInformationMessage(
      "Database downloaded and imported successfully.",
    );
    return item;
  }
  return;
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
  token: CancellationToken,
  cli?: CodeQLCliServer,
): Promise<DatabaseItem | undefined> {
  progress({
    message: "Choose project",
    step: 1,
    maxStep: 2,
  });
  const lgtmUrl = await window.showInputBox({
    prompt:
      "Enter the project slug or URL on LGTM (e.g., g/github/codeql or https://lgtm.com/projects/g/github/codeql)",
  });
  if (!lgtmUrl) {
    return;
  }

  if (looksLikeLgtmUrl(lgtmUrl)) {
    const databaseUrl = await convertLgtmUrlToDatabaseUrl(lgtmUrl, progress);
    if (databaseUrl) {
      const item = await databaseArchiveFetcher(
        databaseUrl,
        {},
        databaseManager,
        storagePath,
        undefined,
        progress,
        token,
        cli,
      );
      if (item) {
        await commands.executeCommand("codeQLDatabases.focus");
        void showAndLogInformationMessage(
          "Database downloaded and imported successfully.",
        );
      }
      return item;
    }
  } else {
    throw new Error(`Invalid LGTM URL: ${lgtmUrl}`);
  }
  return;
}

export async function retrieveCanonicalRepoName(lgtmUrl: string) {
  const givenRepoName = extractProjectSlug(lgtmUrl);
  const response = await checkForFailingResponse(
    await fetch(`https://api.github.com/repos/${givenRepoName}`),
    "Failed to locate the repository on github",
  );
  const repo = await response.json();
  if (!repo || !repo.full_name) {
    return;
  }
  return repo.full_name;
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
      token,
      cli,
    );
    if (item) {
      await commands.executeCommand("codeQLDatabases.focus");
      void showAndLogInformationMessage(
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
 * @param token cancellation token
 */
async function databaseArchiveFetcher(
  databaseUrl: string,
  requestHeaders: { [key: string]: string },
  databaseManager: DatabaseManager,
  storagePath: string,
  nameOverride: string | undefined,
  progress: ProgressCallback,
  token: CancellationToken,
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

    const item = await databaseManager.openDatabase(
      progress,
      token,
      Uri.file(dbPath),
      nameOverride,
    );
    await databaseManager.setCurrentDatabaseItem(item);
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
  if (cli && (await cli.cliConstraints.supportsDatabaseUnbundle())) {
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

/**
 * The URL pattern is https://github.com/{owner}/{name}/{subpages}.
 *
 * This function accepts any URL that matches the pattern above. It also accepts just the
 * name with owner (NWO): `<owner>/<repo>`.
 *
 * @param githubRepo The GitHub repository URL or NWO
 *
 * @return true if this looks like a valid GitHub repository URL or NWO
 */
export function looksLikeGithubRepo(
  githubRepo: string | undefined,
): githubRepo is string {
  if (!githubRepo) {
    return false;
  }
  if (REPO_REGEX.test(githubRepo) || convertGitHubUrlToNwo(githubRepo)) {
    return true;
  }
  return false;
}

/**
 * Converts a GitHub repository URL to the corresponding NWO.
 * @param githubUrl The GitHub repository URL
 * @return The corresponding NWO, or undefined if the URL is not valid
 */
function convertGitHubUrlToNwo(githubUrl: string): string | undefined {
  try {
    const uri = Uri.parse(githubUrl, true);
    if (uri.scheme !== "https") {
      return;
    }
    if (uri.authority !== "github.com" && uri.authority !== "www.github.com") {
      return;
    }
    const paths = uri.path.split("/").filter((segment: string) => segment);
    const nwo = `${paths[0]}/${paths[1]}`;
    if (REPO_REGEX.test(nwo)) {
      return nwo;
    }
    return;
  } catch (e) {
    // Ignore the error here, since we catch failures at a higher level.
    // In particular: returning undefined leads to an error in 'promptImportGithubDatabase'.
    return;
  }
}

export async function convertGithubNwoToDatabaseUrl(
  githubRepo: string,
  octokit: Octokit.Octokit,
  progress: ProgressCallback,
): Promise<
  | {
      databaseUrl: string;
      owner: string;
      name: string;
    }
  | undefined
> {
  try {
    const nwo = convertGitHubUrlToNwo(githubRepo) || githubRepo;
    const [owner, repo] = nwo.split("/");

    const response = await octokit.request(
      "GET /repos/:owner/:repo/code-scanning/codeql/databases",
      { owner, repo },
    );

    const languages = response.data.map((db: any) => db.language);

    const language = await promptForLanguage(languages, progress);
    if (!language) {
      return;
    }

    return {
      databaseUrl: `https://api.github.com/repos/${owner}/${repo}/code-scanning/codeql/databases/${language}`,
      owner,
      name: repo,
    };
  } catch (e) {
    void extLogger.log(`Error: ${getErrorMessage(e)}`);
    throw new Error(`Unable to get database for '${githubRepo}'`);
  }
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
export function looksLikeLgtmUrl(
  lgtmUrl: string | undefined,
): lgtmUrl is string {
  if (!lgtmUrl) {
    return false;
  }

  if (convertRawLgtmSlug(lgtmUrl)) {
    return true;
  }

  try {
    const uri = Uri.parse(lgtmUrl, true);
    if (uri.scheme !== "https") {
      return false;
    }

    if (uri.authority !== "lgtm.com" && uri.authority !== "www.lgtm.com") {
      return false;
    }

    const paths = uri.path.split("/").filter((segment: string) => segment);
    return paths.length >= 4 && paths[0] === "projects";
  } catch (e) {
    return false;
  }
}

function convertRawLgtmSlug(maybeSlug: string): string | undefined {
  if (!maybeSlug) {
    return;
  }
  const segments = maybeSlug.split("/");
  const providers = ["g", "gl", "b", "git"];
  if (segments.length === 3 && providers.includes(segments[0])) {
    return `https://lgtm.com/projects/${maybeSlug}`;
  }
  return;
}

function extractProjectSlug(lgtmUrl: string): string | undefined {
  // Only matches the '/g/' provider (github)
  const re = new RegExp("https://lgtm.com/projects/g/(.*[^/])");
  const match = lgtmUrl.match(re);
  if (!match) {
    return;
  }
  return match[1];
}

// exported for testing
export async function convertLgtmUrlToDatabaseUrl(
  lgtmUrl: string,
  progress: ProgressCallback,
) {
  try {
    lgtmUrl = convertRawLgtmSlug(lgtmUrl) || lgtmUrl;
    let projectJson = await downloadLgtmProjectMetadata(lgtmUrl);

    if (projectJson.code === 404) {
      // fallback check for github repositories with same name but different case
      // will fail for other providers
      let canonicalName = await retrieveCanonicalRepoName(lgtmUrl);
      if (!canonicalName) {
        throw new Error(`Project was not found at ${lgtmUrl}.`);
      }
      canonicalName = convertRawLgtmSlug(`g/${canonicalName}`);
      projectJson = await downloadLgtmProjectMetadata(canonicalName);
      if (projectJson.code === 404) {
        throw new Error("Failed to download project from LGTM.");
      }
    }

    const languages =
      projectJson?.languages?.map(
        (lang: { language: string }) => lang.language,
      ) || [];

    const language = await promptForLanguage(languages, progress);
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
  } catch (e) {
    void extLogger.log(`Error: ${getErrorMessage(e)}`);
    throw new Error(`Invalid LGTM URL: ${lgtmUrl}`);
  }
}

async function downloadLgtmProjectMetadata(lgtmUrl: string): Promise<any> {
  const uri = Uri.parse(lgtmUrl, true);
  const paths = ["api", "v1.0"]
    .concat(uri.path.split("/").filter((segment: string) => segment))
    .slice(0, 6);
  const projectUrl = `https://lgtm.com/${paths.join("/")}`;
  const projectResponse = await fetch(projectUrl);
  return projectResponse.json();
}

async function promptForLanguage(
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
  const srcZipPath = srcFolderPath + ".zip";

  if ((await pathExists(srcFolderPath)) && !(await pathExists(srcZipPath))) {
    await zip(srcFolderPath, srcZipPath);
    await remove(srcFolderPath);
  }
}
