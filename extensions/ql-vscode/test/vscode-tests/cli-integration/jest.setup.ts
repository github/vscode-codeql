import { workspace } from "vscode";

import {
  afterAllAction,
  beforeAllAction,
  beforeEachAction,
} from "../jest.activated-extension.setup";
import { createWriteStream, existsSync, mkdirpSync } from "fs-extra";
import { dirname, join } from "path";
import { DB_URL, dbLoc, testprojLoc } from "../global.helper";
import { renameSync } from "fs";
import { unzipToDirectoryConcurrently } from "../../../src/common/unzip-concurrently";
import { platform } from "os";
import { sleep } from "../../../src/common/time";

beforeAll(async () => {
  // ensure the test database is downloaded
  const dbParentDir = dirname(dbLoc);
  mkdirpSync(dbParentDir);
  if (!existsSync(dbLoc)) {
    console.log(`Downloading test database to ${dbLoc}`);

    const response = await fetch(DB_URL);
    if (!response.body) {
      throw new Error("No response body found");
    }
    if (!response.ok) {
      throw new Error(`Failed to download test database: ${response.status}`);
    }

    const dest = createWriteStream(dbLoc);

    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      await new Promise((resolve, reject) => {
        dest.write(value, (err) => {
          if (err) {
            reject(err);
          }
          resolve(undefined);
        });
      });
    }

    await new Promise((resolve, reject) =>
      dest.close((err) => {
        if (err) {
          reject(err);
        }
        resolve(undefined);
      }),
    );
  }

  // unzip the database from dbLoc to testprojLoc
  if (!existsSync(testprojLoc)) {
    console.log(`Unzipping test database to ${testprojLoc}`);
    await unzipToDirectoryConcurrently(dbLoc, dbParentDir);
    // On Windows, wait a few seconds to make sure all background processes
    // release their lock on the files before renaming the directory.
    if (platform() === "win32") {
      await sleep(3000);
    }
    renameSync(join(dbParentDir, "db"), testprojLoc);
    console.log("Unzip completed.");
  }

  await beforeAllAction();
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
