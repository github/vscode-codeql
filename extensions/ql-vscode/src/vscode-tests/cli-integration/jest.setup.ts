import * as fs from "fs-extra";
import * as path from "path";
import fetch from "node-fetch";
import { DB_URL, dbLoc, setStoragePath, storagePath } from "./global.helper";
import * as tmp from "tmp";
import { getTestSetting } from "../test-config";
import { CUSTOM_CODEQL_PATH_SETTING } from "../../config";
import { extensions, workspace } from "vscode";

import baseJestSetup from "../jest.setup";

export default baseJestSetup;

// create an extension storage location
let removeStorage: tmp.DirResult["removeCallback"] | undefined;

beforeAll(async () => {
  // Set the CLI version here before activation to ensure we don't accidentally try to download a cli
  await getTestSetting(CUSTOM_CODEQL_PATH_SETTING)?.setInitialTestValue(
    process.env.CLI_PATH,
  );
  await getTestSetting(CUSTOM_CODEQL_PATH_SETTING)?.setup();

  // ensure the test database is downloaded
  fs.mkdirpSync(path.dirname(dbLoc));
  if (!fs.existsSync(dbLoc)) {
    console.log(`Downloading test database to ${dbLoc}`);

    await new Promise((resolve, reject) => {
      return fetch(DB_URL).then((response) => {
        const dest = fs.createWriteStream(dbLoc);
        response.body.pipe(dest);

        response.body.on("error", reject);
        dest.on("error", reject);
        dest.on("close", () => {
          resolve(dbLoc);
        });
      });
    });
  }

  // Create the temp directory to be used as extension local storage.
  const dir = tmp.dirSync();
  let storagePath = fs.realpathSync(dir.name);
  if (storagePath.substring(0, 2).match(/[A-Z]:/)) {
    storagePath =
      storagePath.substring(0, 1).toLocaleLowerCase() +
      storagePath.substring(1);
  }
  setStoragePath(storagePath);

  removeStorage = dir.removeCallback;

  // check that the codeql folder is found in the workspace
  const folders = workspace.workspaceFolders;
  if (!folders) {
    throw new Error(
      'No workspace folders found.\nYou will need a local copy of the codeql repo.\nMake sure you specify the path to it in launch.json.\nIt should be something along the lines of "${workspaceRoot}/../codeql" depending on where you have your local copy of the codeql repo.',
    );
  } else {
    const codeqlFolder = folders.find((folder) => folder.name === "codeql");
    if (!codeqlFolder) {
      throw new Error(
        'No workspace folders found.\nYou will need a local copy of the codeql repo.\nMake sure you specify the path to it in launch.json.\nIt should be something along the lines of "${workspaceRoot}/../codeql" depending on where you have your local copy of the codeql repo.\n\n\n',
      );
    }
  }

  // Activate the extension
  await extensions.getExtension("GitHub.vscode-codeql")?.activate();
});

// ensure extension is cleaned up.
afterAll(async () => {
  // ensure temp directory is cleaned up.
  try {
    removeStorage?.();
  } catch (e) {
    // we are exiting anyway so don't worry about it.
    // most likely the directory this is a test on Windows and some files are locked.
    console.warn(`Failed to remove storage directory '${storagePath}': ${e}`);
  }
});
