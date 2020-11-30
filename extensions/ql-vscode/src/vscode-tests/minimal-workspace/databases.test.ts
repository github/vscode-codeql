import 'vscode-test';
import 'mocha';
import * as sinon from 'sinon';
import * as tmp from 'tmp';
import * as fs from 'fs-extra';
import * as path from 'path';
import { expect } from 'chai';
import { ExtensionContext, Uri, workspace } from 'vscode';

import {
  DatabaseEventKind,
  DatabaseManager,
  DatabaseItemImpl,
  DatabaseContents,
  isLikelyDbLanguageFolder,
  FullDatabaseOptions
} from '../../databases';
import { QueryServerConfig } from '../../config';
import { Logger } from '../../logging';
import { encodeArchiveBasePath, encodeSourceArchiveUri } from '../../archive-filesystem-provider';

describe('databases', () => {

  const MOCK_DB_OPTIONS: FullDatabaseOptions = {
    dateAdded: 123,
    ignoreSourceArchive: false
  };

  let databaseManager: DatabaseManager;
  let updateSpy: sinon.SinonSpy;
  let getSpy: sinon.SinonStub;
  let dbChangedHandler: sinon.SinonSpy;

  let sandbox: sinon.SinonSandbox;
  let dir: tmp.DirResult;



  beforeEach(() => {
    dir = tmp.dirSync();

    sandbox = sinon.createSandbox();
    updateSpy = sandbox.spy();
    getSpy = sandbox.stub();
    dbChangedHandler = sandbox.spy();
    databaseManager = new DatabaseManager(
      {
        workspaceState: {
          update: updateSpy,
          get: getSpy
        },
        // pretend like databases added in the temp dir are controlled by the extension
        // so that they are deleted upon removal
        storagePath: dir.name
      } as unknown as ExtensionContext,
      {} as QueryServerConfig,
      {} as Logger,
    );

    // Unfortunately, during a test it is not possible to convert from
    // a single root workspace to multi-root, so must stub out relevant
    // functions
    sandbox.stub(workspace, 'updateWorkspaceFolders');
    sandbox.spy(workspace, 'onDidChangeWorkspaceFolders');
  });

  afterEach(async () => {
    dir.removeCallback();
    sandbox.restore();
  });

  it('should fire events when adding and removing a db item', () => {
    const mockDbItem = createMockDB();
    const spy = sinon.spy();
    databaseManager.onDidChangeDatabaseItem(spy);
    (databaseManager as any).addDatabaseItem(mockDbItem);

    expect((databaseManager as any)._databaseItems).to.deep.eq([mockDbItem]);
    expect(updateSpy).to.have.been.calledWith('databaseList', [{
      options: MOCK_DB_OPTIONS,
      uri: dbLocationUri().toString(true)
    }]);
    expect(spy).to.have.been.calledWith({
      item: undefined,
      kind: DatabaseEventKind.Add
    });

    sinon.reset();

    // now remove the item
    databaseManager.removeDatabaseItem(mockDbItem);
    expect((databaseManager as any)._databaseItems).to.deep.eq([]);
    expect(updateSpy).to.have.been.calledWith('databaseList', []);
    expect(spy).to.have.been.calledWith({
      item: undefined,
      kind: DatabaseEventKind.Remove
    });
  });

  it('should rename a db item and emit an event', () => {
    const mockDbItem = createMockDB();
    const spy = sinon.spy();
    databaseManager.onDidChangeDatabaseItem(spy);
    (databaseManager as any).addDatabaseItem(mockDbItem);
    sinon.restore();

    databaseManager.renameDatabaseItem(mockDbItem, 'new name');

    expect(mockDbItem.name).to.eq('new name');
    expect(updateSpy).to.have.been.calledWith('databaseList', [{
      options: { ...MOCK_DB_OPTIONS, displayName: 'new name' },
      uri: dbLocationUri().toString(true)
    }]);

    expect(spy).to.have.been.calledWith({
      item: undefined,
      kind: DatabaseEventKind.Rename
    });
  });

  describe('add / remove database items', () => {
    it('should add a database item', async () => {
      const spy = sandbox.spy();
      databaseManager.onDidChangeDatabaseItem(spy);
      const mockDbItem = createMockDB();

      await (databaseManager as any).addDatabaseItem(mockDbItem);

      expect(databaseManager.databaseItems).to.deep.eq([mockDbItem]);
      expect(updateSpy).to.have.been.calledWith('databaseList', [{
        uri: dbLocationUri().toString(true),
        options: MOCK_DB_OPTIONS
      }]);

      const mockEvent = {
        item: undefined,
        kind: DatabaseEventKind.Add
      };
      expect(spy).to.have.been.calledWith(mockEvent);
    });

    it('should add a database item source archive', async function() {
      const mockDbItem = createMockDB();
      mockDbItem.name = 'xxx';
      await (databaseManager as any).addDatabaseSourceArchiveFolder(mockDbItem);

      // workspace folders should be updated. We can only check the mocks since
      // when running as a test, we are not allowed to update the workspace folders
      expect(workspace.updateWorkspaceFolders).to.have.been.calledWith(1, 0, {
        name: '[xxx source archive]',
        // must use a matcher here since vscode URIs with the same path
        // are not always equal due to internal state.
        uri: sinon.match.has('fsPath', encodeArchiveBasePath(sourceLocationUri().fsPath).fsPath)
      });
    });

    it('should remove a database item', async () => {
      const mockDbItem = createMockDB();
      sandbox.stub(fs, 'remove').resolves();

      // pretend that this item is the first workspace folder in the list
      sandbox.stub(mockDbItem, 'belongsToSourceArchiveExplorerUri').returns(true);

      await (databaseManager as any).addDatabaseItem(mockDbItem);
      updateSpy.resetHistory();

      await databaseManager.removeDatabaseItem(mockDbItem);

      expect(databaseManager.databaseItems).to.deep.eq([]);
      expect(updateSpy).to.have.been.calledWith('databaseList', []);
      // should remove the folder
      expect(workspace.updateWorkspaceFolders).to.have.been.calledWith(0, 1);

      // should also delete the db contents
      expect(fs.remove).to.have.been.calledWith(mockDbItem.databaseUri.fsPath);
    });

    it('should remove a database item outside of the extension controlled area', async () => {
      const mockDbItem = createMockDB();
      sandbox.stub(fs, 'remove').resolves();

      // pretend that this item is the first workspace folder in the list
      sandbox.stub(mockDbItem, 'belongsToSourceArchiveExplorerUri').returns(true);

      await (databaseManager as any).addDatabaseItem(mockDbItem);
      updateSpy.resetHistory();

      // pretend that the database location is not controlled by the extension
      (databaseManager as any).ctx.storagePath = 'hucairz';

      await databaseManager.removeDatabaseItem(mockDbItem);

      expect(databaseManager.databaseItems).to.deep.eq([]);
      expect(updateSpy).to.have.been.calledWith('databaseList', []);
      // should remove the folder
      expect(workspace.updateWorkspaceFolders).to.have.been.calledWith(0, 1);

      // should NOT delete the db contents
      expect(fs.remove).not.to.have.been.called;
    });
  });

  describe('resolveSourceFile', () => {
    it('should fail to resolve when not a uri', () => {
      const db = createMockDB(Uri.parse('file:/sourceArchive-uri/'));
      (db as any)._contents.sourceArchiveUri = undefined;
      expect(() => db.resolveSourceFile('abc')).to.throw('Scheme is missing');
    });

    it('should fail to resolve when not a file uri', () => {
      const db = createMockDB(Uri.parse('file:/sourceArchive-uri/'));
      (db as any)._contents.sourceArchiveUri = undefined;
      expect(() => db.resolveSourceFile('http://abc')).to.throw('Invalid uri scheme');
    });

    describe('no source archive', () => {
      it('should resolve undefined', () => {
        const db = createMockDB(Uri.parse('file:/sourceArchive-uri/'));
        (db as any)._contents.sourceArchiveUri = undefined;
        const resolved = db.resolveSourceFile(undefined);
        expect(resolved.toString(true)).to.eq(dbLocationUri().toString(true));
      });

      it('should resolve an empty file', () => {
        const db = createMockDB(Uri.parse('file:/sourceArchive-uri/'));
        (db as any)._contents.sourceArchiveUri = undefined;
        const resolved = db.resolveSourceFile('file:');
        expect(resolved.toString()).to.eq('file:///');
      });
    });

    describe('zipped source archive', () => {
      it('should encode a source archive url', () => {
        const db = createMockDB(encodeSourceArchiveUri({
          sourceArchiveZipPath: 'sourceArchive-uri',
          pathWithinSourceArchive: 'def'
        }));
        const resolved = db.resolveSourceFile(Uri.file('abc').toString());

        // must recreate an encoded archive uri instead of typing out the
        // text since the uris will be different on windows and ubuntu.
        expect(resolved.toString()).to.eq(encodeSourceArchiveUri({
          sourceArchiveZipPath: 'sourceArchive-uri',
          pathWithinSourceArchive: 'def/abc'
        }).toString());
      });

      it('should encode a source archive url with trailing slash', () => {
        const db = createMockDB(encodeSourceArchiveUri({
          sourceArchiveZipPath: 'sourceArchive-uri',
          pathWithinSourceArchive: 'def/'
        }));
        const resolved = db.resolveSourceFile(Uri.file('abc').toString());

        // must recreate an encoded archive uri instead of typing out the
        // text since the uris will be different on windows and ubuntu.
        expect(resolved.toString()).to.eq(encodeSourceArchiveUri({
          sourceArchiveZipPath: 'sourceArchive-uri',
          pathWithinSourceArchive: 'def/abc'
        }).toString());
      });

      it('should encode an empty source archive url', () => {
        const db = createMockDB(encodeSourceArchiveUri({
          sourceArchiveZipPath: 'sourceArchive-uri',
          pathWithinSourceArchive: 'def'
        }));
        const resolved = db.resolveSourceFile('file:');
        expect(resolved.toString()).to.eq('codeql-zip-archive://1-18/sourceArchive-uri/def/');
      });
    });

    it('should handle an empty file', () => {
      const db = createMockDB(Uri.parse('file:/sourceArchive-uri/'));
      const resolved = db.resolveSourceFile('');
      expect(resolved.toString()).to.eq('file:///sourceArchive-uri/');
    });
  });

  it('should find likely db language folders', () => {
    expect(isLikelyDbLanguageFolder('db-javascript')).to.be.true;
    expect(isLikelyDbLanguageFolder('dbnot-a-db')).to.be.false;
  });

  function createMockDB(
    // source archive location must be a real(-ish) location since
    // tests will add this to the workspace location
    sourceArchiveUri = sourceLocationUri(),
    databaseUri = dbLocationUri()
  ): DatabaseItemImpl {

    return new DatabaseItemImpl(
      databaseUri,
      {
        sourceArchiveUri
      } as DatabaseContents,
      MOCK_DB_OPTIONS,
      dbChangedHandler
    );
  }

  function sourceLocationUri() {
    return Uri.file(path.join(dir.name, 'src.zip'));
  }

  function dbLocationUri() {
    return Uri.file(path.join(dir.name, 'db'));
  }
});
