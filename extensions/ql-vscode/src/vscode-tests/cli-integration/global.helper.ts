import * as path from 'path';
import * as tmp from 'tmp';
import * as fs from 'fs-extra';
import fetch from 'node-fetch';

import { fail } from 'assert';
import { ConfigurationTarget, workspace } from 'vscode';

// This file contains helpers shared between actual tests.

export const DB_URL = 'https://github.com/github/vscode-codeql/files/5586722/simple-db.zip';

// We need to resolve the path, but the final three segments won't exist until later, so we only resolve the
// first portion of the path.
export const dbLoc = path.join(fs.realpathSync(path.join(__dirname, '../../../')), 'build/tests/db.zip');
export let storagePath: string;

// See https://github.com/DefinitelyTyped/DefinitelyTyped/pull/49860
// Should be of type Mocha
export default function(mocha: /*Mocha*/ any) {
  // create an extension storage location
  let removeStorage: tmp.DirResult['removeCallback'] | undefined;

  // ensure the test database is downloaded
  mocha.globalSetup([async () => {
    fs.mkdirpSync(path.dirname(dbLoc));
    if (!fs.existsSync(dbLoc)) {
      try {
        await new Promise((resolve, reject) => {
          fetch(DB_URL).then(response => {
            const dest = fs.createWriteStream(dbLoc);
            response.body.pipe(dest);

            response.body.on('error', reject);
            dest.on('error', reject);
            dest.on('close', () => {
              resolve(dbLoc);
            });
          });
        });
      } catch (e) {
        fail('Failed to download test database: ' + e);
      }
    }
  },

  // Set the CLI version here before activation to ensure we don't accidentally try to download a cli
  async () => {
    await workspace.getConfiguration().update('codeQL.cli.executablePath', process.env.CLI_PATH, ConfigurationTarget.Global);
  },

  // Create the temp directory to be used as extension local storage.
  () => {
    const dir = tmp.dirSync();
    storagePath = fs.realpathSync(dir.name);
    if (storagePath.substring(0, 2).match(/[A-Z]:/)) {
      storagePath = storagePath.substring(0, 1).toLocaleLowerCase() + storagePath.substring(1);
    }

    removeStorage = dir.removeCallback;
  }]);



  mocha.globalTeardown([
    // ensure temp directory is cleaned up.
    () => {
      removeStorage?.();
    }
  ]);
}
