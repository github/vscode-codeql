import { workspace } from "vscode";

import {
  afterAllAction,
  beforeAllAction,
  beforeEachAction,
} from "../jest.activated-extension.setup";
import { createWriteStream, existsSync, mkdirpSync } from "fs-extra";
import { dirname } from "path";
import { DB_URL, dbLoc, getActivatedExtension } from "../global.helper";
import fetch from "node-fetch";

beforeAll(async () => {
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

  await beforeAllAction();

  // Activate the extension
  const extension = await getActivatedExtension();

  if (process.env.CLI_VERSION && process.env.CLI_VERSION !== "nightly") {
    const cliVersion = await extension.cliServer.getVersion();

    if (cliVersion.compare(process.env.CLI_VERSION) !== 0) {
      // This calls the private `updateConfiguration` method in the `ConfigListener`
      // It seems like the CUSTOM_CODEQL_PATH_SETTING.updateValue() call in
      // `beforeAllAction` doesn't fire the event that the config has changed.
      // This is a hacky workaround.
      (
        extension.distributionManager.config as unknown as {
          updateConfiguration: () => void;
        }
      ).updateConfiguration();
    }
  }
});

beforeEach(async () => {
  await beforeEachAction();
});

beforeAll(() => {
  // check that the codeql folder is found in the workspace
  const folders = workspace.workspaceFolders;
  if (!folders) {
    throw new Error(
      'No workspace folders found.\nYou will need a local copy of the codeql repo.\nMake sure you specify the path to it in launch.json.\nIt should be something along the lines of "${workspaceRoot}/../codeql" depending on where you have your local copy of the codeql repo.',
    );
  } else {
    const codeqlFolder = folders.find((folder) =>
      ["codeql", "ql"].includes(folder.name),
    );
    if (!codeqlFolder) {
      throw new Error(
        'No workspace folders found.\nYou will need a local copy of the codeql repo.\nMake sure you specify the path to it in launch.json.\nIt should be something along the lines of "${workspaceRoot}/../codeql" depending on where you have your local copy of the codeql repo.\n\n\n',
      );
    }
  }
});

afterAll(async () => {
  await afterAllAction();
});
