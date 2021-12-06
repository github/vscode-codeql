import { fail } from 'assert';
import { CancellationToken, commands, ExtensionContext, extensions, Uri } from 'vscode';
import * as sinon from 'sinon';
import * as path from 'path';
import * as fs from 'fs-extra';
import 'mocha';
import { expect } from 'chai';
import * as yaml from 'js-yaml';

import { DatabaseItem, DatabaseManager } from '../../databases';
import { CodeQLExtensionInterface } from '../../extension';
import { dbLoc, storagePath } from './global.helper';
import { importArchiveDatabase } from '../../databaseFetcher';
import { compileAndRunQueryAgainstDatabase } from '../../run-queries';
import { CodeQLCliServer } from '../../cli';
import { QueryServerClient } from '../../queryserver-client';
import { skipIfNoCodeQL } from '../ensureCli';
import { QueryResultType } from '../../pure/messages';


/**
 * Integration tests for queries
 */
describe('Queries', function() {
  this.timeout(20000);

  before(function() {
    skipIfNoCodeQL(this);
  });

  let dbItem: DatabaseItem;
  let databaseManager: DatabaseManager;
  let cli: CodeQLCliServer;
  let qs: QueryServerClient;
  let sandbox: sinon.SinonSandbox;
  let progress: sinon.SinonSpy;
  let token: CancellationToken;
  let ctx: ExtensionContext;

  let qlpackFile: string;
  let qlFile: string;


  beforeEach(async () => {
    sandbox = sinon.createSandbox();

    try {
      const extension = await extensions.getExtension<CodeQLExtensionInterface | Record<string, never>>('GitHub.vscode-codeql')!.activate();
      if ('databaseManager' in extension) {
        databaseManager = extension.databaseManager;
        cli = extension.cliServer;
        qs = extension.qs;
        cli.quiet = true;
        ctx = extension.ctx;
        qlpackFile = `${ctx.storagePath}/quick-queries/qlpack.yml`;
        qlFile = `${ctx.storagePath}/quick-queries/quick-query.ql`;
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
        token,
        cli
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
      expect(result.result && result.result.resultType).to.eq(QueryResultType.SUCCESS);
    } catch (e) {
      console.error('Test Failed');
      fail(e);
    }
  });

  // Asserts a fix for bug https://github.com/github/vscode-codeql/issues/733
  it('should restart the database and run a query', async () => {
    try {
      await commands.executeCommand('codeQL.restartQueryServer');
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

      // this message would indicate that the databases were not properly reregistered
      expect(result.result && result.result.message).not.to.eq('No result from server');
      expect(result.options.queryText).to.eq(fs.readFileSync(queryPath, 'utf8'));
      expect(result.result && result.result.resultType).to.eq(QueryResultType.SUCCESS);
    } catch (e) {
      console.error('Test Failed');
      fail(e);
    }
  });

  it('should create a quick query', async () => {
    safeDel(qlFile);
    safeDel(qlpackFile);

    await commands.executeCommand('codeQL.quickQuery');

    // should have created the quick query file and query pack file
    expect(fs.pathExistsSync(qlFile)).to.be.true;
    expect(fs.pathExistsSync(qlpackFile)).to.be.true;

    const qlpackContents: any = await yaml.safeLoad(
      fs.readFileSync(qlpackFile, 'utf8')
    );
    // Should have chosen the js libraries
    expect(qlpackContents.libraryPathDependencies[0]).to.include('javascript');
  });

  it('should avoid creating a quick query', async () => {
    fs.writeFileSync(qlpackFile, yaml.safeDump({
      name: 'quick-query',
      version: '1.0.0',
      libraryPathDependencies: ['codeql-javascript']
    }));
    fs.writeFileSync(qlFile, 'xxx');
    await commands.executeCommand('codeQL.quickQuery');

    // should not have created the quick query file because database schema hasn't changed
    expect(fs.readFileSync(qlFile, 'utf8')).to.eq('xxx');
  });

  function safeDel(file: string) {
    try {
      fs.unlinkSync(file);
    } catch (e) {
      // ignore
    }
  }
});
