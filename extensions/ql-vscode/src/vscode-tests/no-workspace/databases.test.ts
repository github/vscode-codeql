import 'vscode-test';
import 'mocha';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { ExtensionContext, Uri } from 'vscode';

import {
  DatabaseEventKind,
  DatabaseItem,
  DatabaseManager,
  DatabaseItemImpl,
  DatabaseContents,
  isLikelyDbLanguageFolder
} from '../../databases';
import { QueryServerConfig } from '../../config';
import { Logger } from '../../logging';
import { encodeSourceArchiveUri } from '../../archive-filesystem-provider';

describe('databases', () => {
  let databaseManager: DatabaseManager;
  let updateSpy: sinon.SinonSpy;

  beforeEach(() => {
    updateSpy = sinon.spy();
    databaseManager = new DatabaseManager(
      {
        workspaceState: {
          update: updateSpy,
          get: sinon.stub()
        },
      } as unknown as ExtensionContext,
      {} as QueryServerConfig,
      {} as Logger,
    );
  });

  it('should fire events when adding and removing a db item', () => {
    const mockDbItem = {
      databaseUri: { path: 'file:/abc' },
      name: 'abc',
      getPersistedState() {
        return this.name;
      }
    };
    const spy = sinon.spy();
    databaseManager.onDidChangeDatabaseItem(spy);
    (databaseManager as any).addDatabaseItem(mockDbItem);

    expect((databaseManager as any)._databaseItems).to.deep.eq([mockDbItem]);
    expect(updateSpy).to.have.been.calledWith('databaseList', ['abc']);
    expect(spy).to.have.been.calledWith({
      item: undefined,
      kind: DatabaseEventKind.Add
    });

    sinon.reset();

    // now remove the item
    databaseManager.removeDatabaseItem(mockDbItem as unknown as DatabaseItem);
    expect((databaseManager as any)._databaseItems).to.deep.eq([]);
    expect(updateSpy).to.have.been.calledWith('databaseList', []);
    expect(spy).to.have.been.calledWith({
      item: undefined,
      kind: DatabaseEventKind.Remove
    });
  });

  it('should rename a db item and emit an event', () => {
    const mockDbItem = {
      databaseUri: 'file:/abc',
      name: 'abc',
      getPersistedState() {
        return this.name;
      }
    };
    const spy = sinon.spy();
    databaseManager.onDidChangeDatabaseItem(spy);
    (databaseManager as any).addDatabaseItem(mockDbItem);
    sinon.restore();

    databaseManager.renameDatabaseItem(mockDbItem as unknown as DatabaseItem, 'new name');

    expect(mockDbItem.name).to.eq('new name');
    expect(updateSpy).to.have.been.calledWith('databaseList', ['new name']);
    expect(spy).to.have.been.calledWith({
      item: undefined,
      kind: DatabaseEventKind.Rename
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
        expect(resolved.toString()).to.eq('file:///database-uri');
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
    function createMockDB(
      sourceArchiveUri = Uri.parse('file:/sourceArchive-uri'),
      databaseUri = Uri.parse('file:/database-uri')
    ) {
      return new DatabaseItemImpl(
        databaseUri,
        {
          sourceArchiveUri
        } as DatabaseContents,
        {
          dateAdded: 123,
          ignoreSourceArchive: false
        },
        () => { /**/ }
      );
    }
  });

  it('should find likely db language folders', () => {
    expect(isLikelyDbLanguageFolder('db-javascript')).to.be.true;
    expect(isLikelyDbLanguageFolder('dbnot-a-db')).to.be.false;
  });
});
