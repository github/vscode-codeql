import * as fs from 'fs-extra';
import * as path from 'path';
import { DistributionManager, extractZipArchive, codeQlLauncherName } from '../distribution';
import fetch from 'node-fetch';
import { workspace } from 'vscode';

/**
 * This module ensures that the proper CLI is available for tests of the extension.
 * There are two environment variables to control this module:
 *
 *     - CLI_VERSION: The version of the CLI to install. Defaults to the most recent
 *       version. Note that for now, we must maintain the default version by hand.
 *
 *     - CLI_BASE_DIR: The base dir where the CLI will be downloaded and unzipped.
 *       The download location is `${CLI_BASE_DIR}/assets` and the unzip loction is
 *       `${CLI_BASE_DIR}/${CLI_VERSION}`
 *
 * After downloading and unzipping, a new environment variable is set:
 *
 *     - CLI_PATH: Points to the cli executable for the specified CLI_VERSION. This
 *       is variable is available in the unit tests and will be used as the value
 *       for `codeQL.cli.executablePath`.
 *
 * As an optimization, the cli will not be unzipped again if the executable already
 * exists. And the cli will not be re-downloaded if the zip already exists.
 */

process.on('unhandledRejection', e => {
  console.error('Unhandled rejection.');
  console.error(e);
  // Must use a setTimeout in order to ensure the log is fully flushed before exiting
  setTimeout(() => {
    process.exit(-1);
  }, 2000);
});

const _1MB = 1024 * 1024;
const _10MB = _1MB * 10;

// CLI version to test. Hard code the latest as default. And be sure
// to update the env if it is not otherwise set.
const CLI_VERSION = process.env.CLI_VERSION || 'v2.4.2';
process.env.CLI_VERSION = CLI_VERSION;

// Base dir where CLIs will be downloaded into
// By default, put it in the `build` directory in the root of the extension.
const CLI_BASE_DIR = process.env.CLI_DIR || path.normalize(path.join(__dirname, '../../build/cli'));

export async function ensureCli(useCli: boolean) {
  try {
    if (!useCli) {
      console.log('Not downloading CLI. It is not being used.');
      return;
    }

    const assetName = DistributionManager.getRequiredAssetName();
    const url = getCliDownloadUrl(assetName);
    const unzipDir = getCliUnzipDir();
    const downloadedFilePath = getDownloadFilePath(assetName);
    const executablePath = path.join(getCliUnzipDir(), 'codeql', codeQlLauncherName());

    // Use this environment variable to se to the `codeQL.cli.executablePath` in tests
    process.env.CLI_PATH = executablePath;

    if (fs.existsSync(executablePath)) {
      console.log(`CLI version ${CLI_VERSION} is found ${executablePath}. Not going to download again.`);
      return;
    }

    if (!fs.existsSync(downloadedFilePath)) {
      console.log(`CLI version ${CLI_VERSION} zip file not found. Downloading from '${url}' into '${downloadedFilePath}'.`);

      const assetStream = await fetch(url);
      const contentLength = Number(assetStream.headers.get('content-length') || 0);
      console.log('Total content size', Math.round(contentLength / _1MB), 'MB');
      const archiveFile = fs.createWriteStream(downloadedFilePath);
      const body = assetStream.body;
      await new Promise<void>((resolve, reject) => {
        let numBytesDownloaded = 0;
        let lastMessage = 0;
        body.on('data', (data) => {
          numBytesDownloaded += data.length;
          if (numBytesDownloaded - lastMessage > _10MB) {
            console.log('Downloaded', Math.round(numBytesDownloaded / _1MB), 'MB');
            lastMessage = numBytesDownloaded;
          }
          archiveFile.write(data);
        });
        body.on('finish', () => {
          archiveFile.end(() => {
            console.log('Finished download into', downloadedFilePath);
            resolve();
          });
        });
        body.on('error', reject);
      });
    } else {
      console.log(`CLI version ${CLI_VERSION} zip file found at '${downloadedFilePath}'.`);
    }

    console.log(`Unzipping into '${unzipDir}'`);
    fs.mkdirpSync(unzipDir);
    await extractZipArchive(downloadedFilePath, unzipDir);
    console.log('Done.');
  } catch (e) {
    console.error('Failed to download CLI.');
    console.error(e);
    process.exit(-1);
  }
}

/**
 * Heuristically determines if the codeql libraries are installed in this
 * workspace. Looks for the existance of a folder whose path ends in `/codeql`
 */
function hasCodeQL() {
  const folders = workspace.workspaceFolders;
  return !!folders?.some(folder => folder.uri.path.endsWith('/codeql'));
}

export function skipIfNoCodeQL(context: Mocha.Context) {
  if (!hasCodeQL()) {
    console.log([
      'The CodeQL libraries are not available as a folder in this workspace.',
      'To fix in CI: checkout the github/codeql repository and set the \'TEST_CODEQL_PATH\' environment variable to the checked out directory.',
      'To fix when running from vs code, see the comment in the launch.json file in the \'Launch Integration Tests - With CLI\' section.'
    ].join('\n\n'));
    context.skip();
  }
}

/**
 * Url to download from
 */
function getCliDownloadUrl(assetName: string) {
  return `https://github.com/github/codeql-cli-binaries/releases/download/${CLI_VERSION}/${assetName}`;
}

/**
 * Directory to place the downloaded cli into
 */
function getDownloadFilePath(assetName: string) {
  const dir = path.join(CLI_BASE_DIR, 'assets', CLI_VERSION);
  fs.mkdirpSync(dir);
  return path.join(dir, assetName);
}

/**
 * Directory to unzip the downloaded cli into.
 */
function getCliUnzipDir() {
  return path.join(CLI_BASE_DIR, CLI_VERSION);
}
