import 'vscode-test';
import 'mocha';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { ExtensionContext } from 'vscode';

import { DatabaseEventKind, DatabaseItem, DatabaseManager } from '../../databases';
import { QueryServerConfig } from '../../config';
import { Logger } from '../../logging';

describe('databases', () => {
  let databaseManager: DatabaseManager;
  let updateSpy: sinon.SinonSpy;

  beforeEach(() => {
    updateSpy = sinon.spy();
    databaseManager = new DatabaseManager(
      {
        workspaceState: {
          update: updateSpy
        }
      } as unknown as ExtensionContext,
      {} as QueryServerConfig,
      {} as Logger,
    );
  });

  it('should fire events when adding and removing a db item', () => {
    const mockDbItem = {
      databaseUri: 'file:/abc',
      getPersistedState() {
        return this.databaseUri;
      }
    };
    const spy = sinon.spy();
    databaseManager.onDidChangeDatabaseItem(spy);
    (databaseManager as any).addDatabaseItem(mockDbItem);

    expect((databaseManager as any)._databaseItems).to.deep.eq([mockDbItem]);
    expect(updateSpy).to.have.been.calledWith('databaseList', ['file:/abc']);
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

    databaseManager.renameDatabaseItem(mockDbItem as unknown as DatabaseItem, 'new name');

    expect(mockDbItem.name).to.eq('new name');
    expect(updateSpy).to.have.been.calledWith('databaseList', ['new name']);
    expect(spy).to.have.been.calledWith({
      item: undefined,
      kind: DatabaseEventKind.Rename
    });
  });
});
