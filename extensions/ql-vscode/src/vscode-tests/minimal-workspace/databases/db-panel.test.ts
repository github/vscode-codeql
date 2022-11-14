import * as vscode from 'vscode';
import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as pq from 'proxyquire';
import { DbConfig } from '../../../databases/db-config';
import { DbManager } from '../../../databases/db-manager';
import { DbConfigStore } from '../../../databases/db-config-store';
import { DbTreeDataProvider } from '../../../databases/ui/db-tree-data-provider';
import { DbPanel } from '../../../databases/ui/db-panel';
import { DbItemKind } from '../../../databases/db-item';
import { DbTreeViewItem } from '../../../databases/ui/db-tree-view-item';

const proxyquire = pq.noPreserveCache();

describe('db panel', async () => {
  const workspaceStoragePath = path.join(__dirname, 'test-workspace');
  const extensionPath = path.join(__dirname, '../../../../');
  const dbConfigFilePath = path.join(workspaceStoragePath, 'workspace-databases.json');
  let dbTreeDataProvider: DbTreeDataProvider;
  let dbManager: DbManager;
  let dbConfigStore: DbConfigStore;
  let dbPanel: DbPanel;

  before(async () => {
    dbConfigStore = new DbConfigStore(workspaceStoragePath, extensionPath);
    dbManager = new DbManager(dbConfigStore);

    // Create a modified version of the DbPanel module that allows
    // us to override the creation of the DbTreeDataProvider
    const mod = proxyquire('../../../databases/ui/db-panel', {
      './db-tree-data-provider': {
        DbTreeDataProvider: class {
          constructor() {
            return dbTreeDataProvider;
          }
        }
      }
    });

    // Initialize the panel using the modified module
    dbPanel = new mod.DbPanel(dbManager) as DbPanel;
    await dbPanel.initialize();
  });

  beforeEach(async () => {
    await fs.ensureDir(workspaceStoragePath);
  });

  afterEach(async () => {
    await fs.remove(workspaceStoragePath);
  });

  it('should render default local and remote nodes when the config is empty', async () => {
    const dbConfig: DbConfig = {
      remote: {
        repositoryLists: [],
        owners: [],
        repositories: []
      },
      local: {
        lists: [],
        databases: []
      },
    };

    await saveDbConfig(dbConfig);

    const dbTreeItems = await dbTreeDataProvider.getChildren();

    expect(dbTreeItems).to.be.ok;
    const items = dbTreeItems!;
    expect(items.length).to.equal(2);

    const remoteRootNode = items[0];
    expect(remoteRootNode.dbItem).to.be.ok;
    expect(remoteRootNode.dbItem?.kind).to.equal(DbItemKind.RootRemote);
    expect(remoteRootNode.label).to.equal('remote');
    expect(remoteRootNode.tooltip).to.equal('Remote databases');
    expect(remoteRootNode.collapsibleState).to.equal(vscode.TreeItemCollapsibleState.Collapsed);
    expect(remoteRootNode.children).to.be.ok;
    expect(remoteRootNode.children.length).to.equal(3);

    const systemDefinedListItems = remoteRootNode.children.filter(item => item.dbItem?.kind === DbItemKind.RemoteSystemDefinedList);
    expect(systemDefinedListItems.length).to.equal(3);
    checkRemoteSystemDefinedListItem(systemDefinedListItems[0], 10);
    checkRemoteSystemDefinedListItem(systemDefinedListItems[1], 100);
    checkRemoteSystemDefinedListItem(systemDefinedListItems[2], 1000);

    const localRootNode = items[1];
    expect(localRootNode.dbItem).to.be.ok;
    expect(localRootNode.dbItem?.kind).to.equal(DbItemKind.RootLocal);
    expect(localRootNode.label).to.equal('local');
    expect(localRootNode.tooltip).to.equal('Local databases');
    expect(localRootNode.collapsibleState).to.equal(vscode.TreeItemCollapsibleState.Collapsed);
    expect(localRootNode.children).to.be.ok;
    expect(localRootNode.children.length).to.equal(0);
  });

  it('should render remote repository list nodes', async () => {
    const dbConfig: DbConfig = {
      remote: {
        repositoryLists: [
          {
            name: 'my-list-1',
            repositories: [
              'owner1/repo1',
              'owner1/repo2'
            ]
          },
          {
            name: 'my-list-2',
            repositories: [
              'owner1/repo1',
              'owner2/repo1',
              'owner2/repo2'
            ]
          },
        ],
        owners: [],
        repositories: []
      },
      local: {
        lists: [],
        databases: []
      },
    };

    await saveDbConfig(dbConfig);

    const dbTreeItems = await dbTreeDataProvider.getChildren();

    expect(dbTreeItems).to.be.ok;
    const items = dbTreeItems!;
    expect(items.length).to.equal(2);

    const remoteRootNode = items[0];
    expect(remoteRootNode.dbItem).to.be.ok;
    expect(remoteRootNode.collapsibleState).to.equal(vscode.TreeItemCollapsibleState.Collapsed);
    expect(remoteRootNode.children).to.be.ok;
    expect(remoteRootNode.children.length).to.equal(5);

    const systemDefinedListItems = remoteRootNode.children.filter(item => item.dbItem?.kind === DbItemKind.RemoteSystemDefinedList);
    expect(systemDefinedListItems.length).to.equal(3);

    const userDefinedListItems = remoteRootNode.children.filter(item => item.dbItem?.kind === DbItemKind.RemoteUserDefinedList);
    expect(userDefinedListItems.length).to.equal(2);
    checkUserDefinedListItem(userDefinedListItems[0], 'my-list-1', ['owner1/repo1', 'owner1/repo2']);
    checkUserDefinedListItem(userDefinedListItems[1], 'my-list-2', ['owner1/repo1', 'owner2/repo1', 'owner2/repo2']);
  });

  it('should render owner list nodes', async () => {
    const dbConfig: DbConfig = {
      remote: {
        repositoryLists: [],
        owners: ['owner1', 'owner2'],
        repositories: []
      },
      local: {
        lists: [],
        databases: []
      },
    };

    await saveDbConfig(dbConfig);

    const dbTreeItems = await dbTreeDataProvider.getChildren();

    expect(dbTreeItems).to.be.ok;
    const items = dbTreeItems!;
    expect(items.length).to.equal(2);

    const remoteRootNode = items[0];
    expect(remoteRootNode.dbItem).to.be.ok;
    expect(remoteRootNode.collapsibleState).to.equal(vscode.TreeItemCollapsibleState.Collapsed);
    expect(remoteRootNode.children).to.be.ok;
    expect(remoteRootNode.children.length).to.equal(5);

    const ownerListItems = remoteRootNode.children.filter(item => item.dbItem?.kind === DbItemKind.RemoteOwner);
    expect(ownerListItems.length).to.equal(2);
    checkOwnerItem(ownerListItems[0], 'owner1');
    checkOwnerItem(ownerListItems[1], 'owner2');
  });

  it('should render repository nodes', async () => {
    const dbConfig: DbConfig = {
      remote: {
        repositoryLists: [],
        owners: [],
        repositories: ['owner1/repo1', 'owner1/repo2']
      },
      local: {
        lists: [],
        databases: []
      },
    };

    await saveDbConfig(dbConfig);

    const dbTreeItems = await dbTreeDataProvider.getChildren();

    expect(dbTreeItems).to.be.ok;
    const items = dbTreeItems!;
    expect(items.length).to.equal(2);

    const remoteRootNode = items[0];
    expect(remoteRootNode.dbItem).to.be.ok;
    expect(remoteRootNode.collapsibleState).to.equal(vscode.TreeItemCollapsibleState.Collapsed);
    expect(remoteRootNode.children).to.be.ok;
    expect(remoteRootNode.children.length).to.equal(5);

    const repoItems = remoteRootNode.children.filter(item => item.dbItem?.kind === DbItemKind.RemoteRepo);
    expect(repoItems.length).to.equal(2);
    checkRemoteRepoItem(repoItems[0], 'owner1/repo1');
    checkRemoteRepoItem(repoItems[1], 'owner1/repo2');
  });

  async function saveDbConfig(dbConfig: DbConfig): Promise<void> {
    await fs.writeJson(dbConfigFilePath, dbConfig);

    // Once we have watching of the db config, this can happen
    // at the start of the test.
    await dbConfigStore.initialize();
    dbTreeDataProvider = new DbTreeDataProvider(dbManager);
  }

  function checkRemoteSystemDefinedListItem(
    item: DbTreeViewItem,
    n: number
  ): void {
    expect(item.label).to.equal(`Top ${n} repositories`);
    expect(item.tooltip).to.equal(`Top ${n} repositories of a language`);
    expect(item.iconPath).to.deep.equal(new vscode.ThemeIcon('github'));
    expect(item.collapsibleState).to.equal(vscode.TreeItemCollapsibleState.None);
  }

  function checkUserDefinedListItem(
    item: DbTreeViewItem,
    listName: string,
    repos: string[]
  ): void {
    expect(item.label).to.equal(listName);
    expect(item.tooltip).to.be.undefined;
    expect(item.iconPath).to.be.undefined;
    expect(item.collapsibleState).to.equal(vscode.TreeItemCollapsibleState.Collapsed);
    expect(item.children).to.be.ok;
    expect(item.children.length).to.equal(repos.length);

    for (let i = 0; i < repos.length; i++) {
      checkRemoteRepoItem(item.children[i], repos[i]);
    }
  }

  function checkOwnerItem(
    item: DbTreeViewItem,
    ownerName: string
  ): void {
    expect(item.label).to.equal(ownerName);
    expect(item.tooltip).to.be.undefined;
    expect(item.iconPath).to.deep.equal(new vscode.ThemeIcon('organization'));
    expect(item.collapsibleState).to.equal(vscode.TreeItemCollapsibleState.None);
    expect(item.children).to.be.ok;
    expect(item.children.length).to.equal(0);
  }

  function checkRemoteRepoItem(
    item: DbTreeViewItem,
    repoName: string
  ): void {
    expect(item.label).to.equal(repoName);
    expect(item.tooltip).to.be.undefined;
    expect(item.iconPath).to.deep.equal(new vscode.ThemeIcon('database'));
    expect(item.collapsibleState).to.equal(vscode.TreeItemCollapsibleState.None);
  }
});
