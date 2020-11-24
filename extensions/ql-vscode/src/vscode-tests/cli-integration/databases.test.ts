import 'mocha';
import 'sinon-chai';
import * as sinon from 'sinon';
import * as path from 'path';
import * as tmp from 'tmp';

import { expect } from 'chai';
import { ConfigurationTarget, workspace, extensions, CancellationToken, Uri } from 'vscode';
import * as vscode from 'vscode';
import * as fs from 'fs-extra';

import { CodeQLExtensionInterface } from '../../extension';
import { DatabaseManager } from '../../databases';
import { promptImportLgtmDatabase, importArchiveDatabase, promptImportInternetDatabase } from '../../databaseFetcher';
import { ProgressCallback } from '../../helpers';
import { fail } from 'assert';
import fetch from 'node-fetch';

/**
 * Run various integration tests for databases
 */
describe('Databases', function() {
  const DB_URL = 'https://github.com/github/vscode-codeql/files/5586722/simple-db.zip';
  const LGTM_URL = 'https://lgtm.com/projects/g/aeisenberg/angular-bind-notifier/';

  this.timeout(60000);

  let databaseManager: DatabaseManager;
  let sandbox: sinon.SinonSandbox;
  let storagePath: string;
  let storagePathCleanup: () => void;
  let inputBoxStub: sinon.SinonStub;
  let progressCallback: ProgressCallback;


  beforeEach(async () => {
    try {
      // Set it here before activation to ensure we don't accidentally try to download a cli
      await workspace.getConfiguration().update('codeQL.cli.executablePath', process.env.CLI_PATH, ConfigurationTarget.Global);
      const extension = await extensions.getExtension<CodeQLExtensionInterface | {}>('GitHub.vscode-codeql')!.activate();
      if ('cliServer' in extension) {
        databaseManager = extension.databaseManager;
      } else {
        throw new Error('Extension not initialized. Make sure cli is downloaded and installed properly.');
      }

      sandbox = sinon.createSandbox();
      const dir = tmp.dirSync();
      storagePath = dir.name;
      // the uri.fsPath function on windows returns a lowercase drive letter
      // so, force the storage path string to be lowercase, too.
      if (storagePath.substring(0, 2).match(/[A-Z]:/)) {
        storagePath = storagePath.substring(0, 1).toLocaleLowerCase() + storagePath.substring(1);
      }
      storagePathCleanup = dir.removeCallback;
      progressCallback = sandbox.spy();
      inputBoxStub = sandbox.stub(vscode.window, 'showInputBox');
    } catch (e) {
      fail(e);
    }
  });

  afterEach(() => {
    try {
      databaseManager.dispose();
      sandbox.restore();
      storagePathCleanup();
    } catch (e) {
      fail(e);
    }
  });

  it('should add a database from a folder', async () => {
    const result = await downloadDb();
    try {
      const progressCallback = sandbox.spy() as ProgressCallback;
      const uri = Uri.file(result.dbLoc);
      let dbItem = await importArchiveDatabase(uri.toString(true), databaseManager, storagePath, progressCallback, {} as CancellationToken);
      expect(dbItem).to.be.eq(databaseManager.currentDatabaseItem);
      expect(dbItem).to.be.eq(databaseManager.databaseItems[0]);
      expect(dbItem).not.to.be.undefined;
      dbItem = dbItem!;
      expect(dbItem.name).to.eq('db');
      expect(dbItem.databaseUri.fsPath).to.eq(path.join(storagePath, 'db', 'db'));
    } finally {
      result.removeCallback();
    }
  });

  it('should add a database from lgtm with only one language', async () => {
    inputBoxStub.resolves(LGTM_URL);
    let dbItem = await promptImportLgtmDatabase(databaseManager, storagePath, progressCallback, {} as CancellationToken);
    expect(dbItem).not.to.be.undefined;
    dbItem = dbItem!;
    expect(dbItem.name).to.eq('aeisenberg_angular-bind-notifier_106179a');
    expect(dbItem.databaseUri.fsPath).to.eq(path.join(storagePath, 'javascript', 'aeisenberg_angular-bind-notifier_106179a'));
  });

  it('should add a database from a url', async () => {
    inputBoxStub.resolves(DB_URL);

    let dbItem = await promptImportInternetDatabase(databaseManager, storagePath, progressCallback, {} as CancellationToken);
    expect(dbItem).not.to.be.undefined;
    dbItem = dbItem!;
    expect(dbItem.name).to.eq('db');
    expect(dbItem.databaseUri.fsPath).to.eq(path.join(storagePath, 'simple-db', 'db'));
  });

  async function downloadDb(): Promise<{
    removeCallback: () => void; dbLoc: string;
  }> {
    return new Promise((resolve, reject) => {
      fetch(DB_URL).then(response => {
        const dir = tmp.dirSync();
        const dbLoc = path.join(dir.name, 'db.zip');
        const dest = fs.createWriteStream(dbLoc);
        response.body.pipe(dest);

        response.body.on('error', reject);
        dest.on('error', reject);
        dest.on('close', () => {
          resolve({
            removeCallback: dir.removeCallback,
            dbLoc
          });
        });
      });
    });
  }
});
