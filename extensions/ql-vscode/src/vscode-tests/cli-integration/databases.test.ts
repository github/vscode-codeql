import * as sinon from 'sinon';
import * as path from 'path';
import { fail } from 'assert';
import { extensions, CancellationToken, Uri, window } from 'vscode';

import { CodeQLExtensionInterface } from '../../extension';
import { CodeQLCliServer } from '../../cli';
import { DatabaseManager } from '../../databases';
import { promptImportLgtmDatabase, importArchiveDatabase, promptImportInternetDatabase } from '../../databaseFetcher';
import { ProgressCallback } from '../../commandRunner';
import { cleanDatabases, dbLoc, DB_URL, storagePath } from './global.helper';

/**
 * Run various integration tests for databases
 */
describe('Databases', () => {
  this.timeout(60000);

  const LGTM_URL = 'https://lgtm.com/projects/g/aeisenberg/angular-bind-notifier/';

  let databaseManager: DatabaseManager;
  let sandbox: sinon.SinonSandbox;
  let inputBoxStub: sinon.SinonStub;
  let cli: CodeQLCliServer;
  let progressCallback: ProgressCallback;

  beforeEach(async () => {
    try {
      sandbox = sinon.createSandbox();
      // the uri.fsPath function on windows returns a lowercase drive letter
      // so, force the storage path string to be lowercase, too.
      progressCallback = sandbox.spy();
      inputBoxStub = sandbox.stub(window, 'showInputBox');
      sandbox.stub(window, 'showErrorMessage');
      sandbox.stub(window, 'showInformationMessage');

      const extension = await extensions.getExtension<CodeQLExtensionInterface | Record<string, never>>('GitHub.vscode-codeql')!.activate();
      if ('databaseManager' in extension) {
        databaseManager = extension.databaseManager;
      } else {
        throw new Error('Extension not initialized. Make sure cli is downloaded and installed properly.');
      }

      await cleanDatabases(databaseManager);
    } catch (e) {
      fail(e as Error);
    }
  });

  afterEach(async () => {
    try {
      sandbox.restore();
      await cleanDatabases(databaseManager);
    } catch (e) {
      fail(e as Error);
    }
  });

  it('should add a database from a folder', async () => {
    const progressCallback = sandbox.spy() as ProgressCallback;
    const uri = Uri.file(dbLoc);
    let dbItem = await importArchiveDatabase(uri.toString(true), databaseManager, storagePath, progressCallback, {} as CancellationToken, cli);
    expect(dbItem).toBe(databaseManager.currentDatabaseItem);
    expect(dbItem).toBe(databaseManager.databaseItems[0]);
    expect(dbItem).toBeDefined();
    dbItem = dbItem!;
    expect(dbItem.name).toBe('db');
    expect(dbItem.databaseUri.fsPath).toBe(path.join(storagePath, 'db', 'db'));
  });

  it('should add a database from lgtm with only one language', async () => {
    inputBoxStub.resolves(LGTM_URL);
    let dbItem = await promptImportLgtmDatabase(databaseManager, storagePath, progressCallback, {} as CancellationToken, cli);
    expect(dbItem).toBeDefined();
    dbItem = dbItem!;
    expect(dbItem.name).toBe('aeisenberg_angular-bind-notifier_106179a');
    expect(dbItem.databaseUri.fsPath).toBe(
      path.join(storagePath, 'javascript', 'aeisenberg_angular-bind-notifier_106179a')
    );
  });

  it('should add a database from a url', async () => {
    inputBoxStub.resolves(DB_URL);

    let dbItem = await promptImportInternetDatabase(databaseManager, storagePath, progressCallback, {} as CancellationToken, cli);
    expect(dbItem).toBeDefined();
    dbItem = dbItem!;
    expect(dbItem.name).toBe('db');
    expect(dbItem.databaseUri.fsPath).toBe(path.join(storagePath, 'simple-db', 'db'));
  });

});
