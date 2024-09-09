import { existsSync, createWriteStream, mkdirpSync } from "fs-extra";
import { normalize, join } from "path";
import {
  getRequiredAssetName,
  codeQlLauncherName,
} from "../../src/common/distribution";
import { unzipToDirectorySequentially } from "../../src/common/unzip";
import supportedCliVersions from "../../supported_cli_versions.json";

/**
 * This module ensures that the proper CLI is available for tests of the extension.
 * There are three environment variables to control this module:
 *
 *     - CLI_VERSION: The version of the CLI to install. Defaults to the most recent
 *       version. Note that for now, we must maintain the default version by hand.
 *       This may be set to `nightly`, in which case the `NIGHTLY_URL` variable must
 *       also be set.
 *
 *     - NIGHTLY_URL: The URL for a nightly release of the CodeQL CLI that will be
 *       used if `CLI_VERSION` is set to `nightly`.
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

const _1MB = 1024 * 1024;
const _10MB = _1MB * 10;
const _100MB = _10MB * 10;

// CLI version to test. Use the latest supported version by default.
// And be sure to update the env if it is not otherwise set.
const CLI_VERSION = process.env.CLI_VERSION || supportedCliVersions[0];
process.env.CLI_VERSION = CLI_VERSION;

// Base dir where CLIs will be downloaded into
// By default, put it in the `build` directory in the root of the extension.
const CLI_BASE_DIR =
  process.env.CLI_DIR || normalize(join(__dirname, "../../build/cli"));

export async function ensureCli(useCli: boolean) {
  try {
    if (!useCli) {
      console.log("Not downloading CLI. It is not being used.");
      return;
    }

    if ("CLI_PATH" in process.env) {
      const executablePath = process.env.CLI_PATH;
      console.log(`Using existing CLI at ${executablePath}`);

      // The CLI_VERSION env variable is not used when the CLI_PATH is set.
      delete process.env.CLI_VERSION;
      return;
    }

    const assetName = getRequiredAssetName();
    const url = getCliDownloadUrl(assetName);
    const unzipDir = getCliUnzipDir();
    const downloadedFilePath = getDownloadFilePath(assetName);
    const executablePath = join(
      getCliUnzipDir(),
      "codeql",
      codeQlLauncherName(),
    );

    // Use this environment variable to se to the `codeQL.cli.executablePath` in tests
    process.env.CLI_PATH = executablePath;

    if (existsSync(executablePath)) {
      console.log(
        `CLI version ${CLI_VERSION} is found ${executablePath}. Not going to download again.`,
      );
      return;
    }

    if (!existsSync(downloadedFilePath)) {
      console.log(
        `CLI version ${CLI_VERSION} zip file not found. Downloading from '${url}' into '${downloadedFilePath}'.`,
      );

      await downloadWithProgress(url, downloadedFilePath);
    } else {
      console.log(
        `CLI version ${CLI_VERSION} zip file found at '${downloadedFilePath}'.`,
      );
    }

    console.log(`Unzipping into '${unzipDir}'`);
    mkdirpSync(unzipDir);
    await unzipWithProgress(downloadedFilePath, unzipDir);
    console.log("Done.");
  } catch (e) {
    console.error("Failed to download CLI.");
    console.error(e);
    process.exit(-1);
  }
}

async function downloadWithProgress(url: string, filePath: string) {
  const assetStream = await fetch(url);
  const contentLength = Number(assetStream.headers.get("content-length") || 0);
  console.log("Total content size", Math.round(contentLength / _1MB), "MB");
  const archiveFile = createWriteStream(filePath);
  const body = assetStream.body?.getReader();
  if (!body) {
    throw new Error("No response body found");
  }

  let numBytesDownloaded = 0;
  let lastMessage = 0;

  // eslint-disable-next-line no-constant-condition -- This is a loop that reads from a stream
  while (true) {
    const { done, value } = await body.read();
    if (done) {
      return new Promise((resolve) => {
        archiveFile.end(() => {
          console.log("Finished download into", filePath);
          resolve(undefined);
        });
      });
    }

    numBytesDownloaded += value.length;
    if (numBytesDownloaded - lastMessage > _10MB) {
      console.log("Downloaded", Math.round(numBytesDownloaded / _1MB), "MB");
      lastMessage = numBytesDownloaded;
    }
    archiveFile.write(value);
  }
}

async function unzipWithProgress(
  filePath: string,
  unzipDir: string,
): Promise<void> {
  let lastMessage = 0;

  await unzipToDirectorySequentially(
    filePath,
    unzipDir,
    ({ bytesExtracted, totalBytes }) => {
      if (bytesExtracted - lastMessage > _100MB) {
        console.log(
          "Extracted",
          Math.round(bytesExtracted / _1MB),
          "MB /",
          Math.round(totalBytes / _1MB),
          "MB",
        );
        lastMessage = bytesExtracted;
      }
    },
  );

  console.log("Finished unzipping into", unzipDir);
}

/**
 * Url to download from
 */
function getCliDownloadUrl(assetName: string) {
  if (CLI_VERSION === "nightly") {
    if (!process.env.NIGHTLY_URL) {
      throw new Error(
        "Nightly CLI was specified but no URL to download it from was given!",
      );
    }
    return `${process.env.NIGHTLY_URL}/${assetName}`;
  }
  return `https://github.com/github/codeql-cli-binaries/releases/download/${CLI_VERSION}/${assetName}`;
}

/**
 * Directory to place the downloaded cli into
 */
function getDownloadFilePath(assetName: string) {
  const dir = join(CLI_BASE_DIR, "assets", CLI_VERSION);
  mkdirpSync(dir);
  return join(dir, assetName);
}

/**
 * Directory to unzip the downloaded cli into.
 */
function getCliUnzipDir() {
  return join(CLI_BASE_DIR, CLI_VERSION);
}
