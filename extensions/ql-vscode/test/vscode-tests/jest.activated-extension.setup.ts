import {
  mkdirpSync,
  existsSync,
  createWriteStream,
  realpathSync,
} from "fs-extra";
import { dirname } from "path";
import fetch from "node-fetch";
import { DB_URL, dbLoc, setStoragePath, storagePath } from "./global.helper";
import * as tmp from "tmp";
import { CUSTOM_CODEQL_PATH_SETTING } from "../../src/config";
import { ConfigurationTarget, env, extensions } from "vscode";
import { beforeEachAction } from "./test-config";

// create an extension storage location
let removeStorage: tmp.DirResult["removeCallback"] | undefined;

jest.retryTimes(3, {
  logErrorsBeforeRetry: true,
});

beforeAll(async () => {
  // Set the CLI version here before activation to ensure we don't accidentally try to download a cli
  await beforeEachAction();
  await CUSTOM_CODEQL_PATH_SETTING.updateValue(
    process.env.CLI_PATH,
    ConfigurationTarget.Workspace,
  );

  // ensure the test database is downloaded
  mkdirpSync(dirname(dbLoc));
  if (!existsSync(dbLoc)) {
    console.log(`Downloading test database to ${dbLoc}`);

    await new Promise((resolve, reject) => {
      return fetch(DB_URL).then((response) => {
        const dest = createWriteStream(dbLoc);
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
  let storagePath = realpathSync(dir.name);
  if (storagePath.substring(0, 2).match(/[A-Z]:/)) {
    storagePath =
      storagePath.substring(0, 1).toLocaleLowerCase() +
      storagePath.substring(1);
  }
  setStoragePath(storagePath);

  removeStorage = dir.removeCallback;

  // Activate the extension
  await extensions.getExtension("GitHub.vscode-codeql")?.activate();
});

beforeEach(async () => {
  jest.spyOn(env, "openExternal").mockResolvedValue(false);

  await beforeEachAction();

  await CUSTOM_CODEQL_PATH_SETTING.updateValue(
    process.env.CLI_PATH,
    ConfigurationTarget.Workspace,
  );
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
