import { fail } from 'assert';
import { CancellationToken, extensions, Uri } from 'vscode';
import * as sinon from 'sinon';
import * as path from 'path';
import * as fs from 'fs-extra';
import 'mocha';
import { expect } from 'chai';

import { DatabaseItem, DatabaseManager } from '../../databases';
import { CodeQLExtensionInterface } from '../../extension';
import { dbLoc, storagePath } from './global.helper';
import { importArchiveDatabase } from '../../databaseFetcher';
import { compileAndRunQueryAgainstDatabase } from '../../run-queries';
import { CodeQLCliServer } from '../../cli';
import { QueryServerClient } from '../../queryserver-client';


/**
 * Integration tests for queries
 */
// TODO: Not currently able to run this because we do not have access to the javascript qlpack.
// Need to download ql libraries separately.
xdescribe('Queries', function() {
  this.timeout(20000);

  let dbItem: DatabaseItem;
  let databaseManager: DatabaseManager;
  let cli: CodeQLCliServer;
  let qs: QueryServerClient;
  let sandbox: sinon.SinonSandbox;
  let progress: sinon.SinonSpy;
  let token: CancellationToken;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();

    try {
      const extension = await extensions.getExtension<CodeQLExtensionInterface | {}>('GitHub.vscode-codeql')!.activate();
      if ('databaseManager' in extension) {
        databaseManager = extension.databaseManager;
        cli = extension.cliServer;
        qs = extension.qs;
      } else {
        throw new Error('Extension not initialized. Make sure cli is downloaded and installed properly.');
      }

      progress = sandbox.spy();
      token = {} as CancellationToken;

      // Add a database
      const uri = Uri.file(dbLoc);
      const maybeDbItem = await importArchiveDatabase(
        uri.toString(true),
        databaseManager,
        storagePath,
        progress,
        token
      );

      if (!maybeDbItem) {
        throw new Error('Could not import database');
      }
      dbItem = maybeDbItem;
    } catch (e) {
      fail(e);
    }
  });

  afterEach(() => {
    try {
      databaseManager?.dispose();
      qs?.dispose();
      sandbox.restore();
    } catch (e) {
      fail(e);
    }
  });

  it('should run a query', async () => {
    try {
      const queryPath = path.join(__dirname, 'data', 'simple-query.ql');
      const result = await compileAndRunQueryAgainstDatabase(
        cli,
        qs,
        dbItem,
        false,
        Uri.file(queryPath),
        progress,
        token
      );

      // just check that the query was successful
      expect(result.database.name).to.eq('db');
      expect(result.options.queryText).to.eq(fs.readFileSync(queryPath, 'utf8'));
    } catch (e) {
      console.error('Test Failed');
      fail(e);
    }
  });

});
