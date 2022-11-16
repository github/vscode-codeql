import * as vscode from "vscode";
import { expect } from "chai";
import * as path from "path";
import * as fs from "fs-extra";
import * as pq from "proxyquire";
import { DbConfig } from "../../../databases/config/db-config";
import { DbManager } from "../../../databases/db-manager";
import { DbConfigStore } from "../../../databases/config/db-config-store";
import { DbTreeDataProvider } from "../../../databases/ui/db-tree-data-provider";
import { DbPanel } from "../../../databases/ui/db-panel";
import { DbItemKind, LocalDatabaseDbItem } from "../../../databases/db-item";
import { DbTreeViewItem } from "../../../databases/ui/db-tree-view-item";
import { ExtensionApp } from "../../../common/vscode/vscode-app";
import { createMockExtensionContext } from "../../factories/extension-context";

const proxyquire = pq.noPreserveCache();

describe("db panel", async () => {
  const workspaceStoragePath = path.join(__dirname, "test-workspace-storage");
  const globalStoragePath = path.join(__dirname, "test-global-storage");
  const extensionPath = path.join(__dirname, "../../../../");
  const dbConfigFilePath = path.join(
    workspaceStoragePath,
    "workspace-databases.json",
  );
  let dbTreeDataProvider: DbTreeDataProvider;
  let dbManager: DbManager;
  let dbConfigStore: DbConfigStore;
  let dbPanel: DbPanel;

  before(async () => {
    const extensionContext = createMockExtensionContext({
      extensionPath,
      globalStoragePath,
      workspaceStoragePath,
    });
    await fs.ensureDir(workspaceStoragePath);

    const app = new ExtensionApp(extensionContext);

    dbConfigStore = new DbConfigStore(app);
    dbManager = new DbManager(app, dbConfigStore);

    // Create a modified version of the DbPanel module that allows
    // us to override the creation of the DbTreeDataProvider
    const mod = proxyquire("../../../databases/ui/db-panel", {
      "./db-tree-data-provider": {
        DbTreeDataProvider: class {
          constructor() {
            return dbTreeDataProvider;
          }
        },
      },
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

  it("should render default local and remote nodes when the config is empty", async () => {
    const dbConfig: DbConfig = {
      databases: {
        remote: {
          repositoryLists: [],
          owners: [],
          repositories: [],
        },
        local: {
          lists: [],
          databases: [],
        },
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
    expect(remoteRootNode.label).to.equal("remote");
    expect(remoteRootNode.tooltip).to.equal("Remote databases");
    expect(remoteRootNode.collapsibleState).to.equal(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    expect(remoteRootNode.children).to.be.ok;
    expect(remoteRootNode.children.length).to.equal(3);

    const systemDefinedListItems = remoteRootNode.children.filter(
      (item) => item.dbItem?.kind === DbItemKind.RemoteSystemDefinedList,
    );
    expect(systemDefinedListItems.length).to.equal(3);
    checkRemoteSystemDefinedListItem(systemDefinedListItems[0], 10);
    checkRemoteSystemDefinedListItem(systemDefinedListItems[1], 100);
    checkRemoteSystemDefinedListItem(systemDefinedListItems[2], 1000);

    const localRootNode = items[1];
    expect(localRootNode.dbItem).to.be.ok;
    expect(localRootNode.dbItem?.kind).to.equal(DbItemKind.RootLocal);
    expect(localRootNode.label).to.equal("local");
    expect(localRootNode.tooltip).to.equal("Local databases");
    expect(localRootNode.collapsibleState).to.equal(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    expect(localRootNode.children).to.be.ok;
    expect(localRootNode.children.length).to.equal(0);
  });

  it("should render remote repository list nodes", async () => {
    const dbConfig: DbConfig = {
      databases: {
        remote: {
          repositoryLists: [
            {
              name: "my-list-1",
              repositories: ["owner1/repo1", "owner1/repo2"],
            },
            {
              name: "my-list-2",
              repositories: ["owner1/repo1", "owner2/repo1", "owner2/repo2"],
            },
          ],
          owners: [],
          repositories: [],
        },
        local: {
          lists: [],
          databases: [],
        },
      },
    };

    await saveDbConfig(dbConfig);

    const dbTreeItems = await dbTreeDataProvider.getChildren();

    expect(dbTreeItems).to.be.ok;
    const items = dbTreeItems!;
    expect(items.length).to.equal(2);

    const remoteRootNode = items[0];
    expect(remoteRootNode.dbItem).to.be.ok;
    expect(remoteRootNode.collapsibleState).to.equal(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    expect(remoteRootNode.children).to.be.ok;
    expect(remoteRootNode.children.length).to.equal(5);

    const systemDefinedListItems = remoteRootNode.children.filter(
      (item) => item.dbItem?.kind === DbItemKind.RemoteSystemDefinedList,
    );
    expect(systemDefinedListItems.length).to.equal(3);

    const userDefinedListItems = remoteRootNode.children.filter(
      (item) => item.dbItem?.kind === DbItemKind.RemoteUserDefinedList,
    );
    expect(userDefinedListItems.length).to.equal(2);
    checkUserDefinedListItem(userDefinedListItems[0], "my-list-1", [
      "owner1/repo1",
      "owner1/repo2",
    ]);
    checkUserDefinedListItem(userDefinedListItems[1], "my-list-2", [
      "owner1/repo1",
      "owner2/repo1",
      "owner2/repo2",
    ]);
  });

  it("should render owner list nodes", async () => {
    const dbConfig: DbConfig = {
      databases: {
        remote: {
          repositoryLists: [],
          owners: ["owner1", "owner2"],
          repositories: [],
        },
        local: {
          lists: [],
          databases: [],
        },
      },
    };

    await saveDbConfig(dbConfig);

    const dbTreeItems = await dbTreeDataProvider.getChildren();

    expect(dbTreeItems).to.be.ok;
    const items = dbTreeItems!;
    expect(items.length).to.equal(2);

    const remoteRootNode = items[0];
    expect(remoteRootNode.dbItem).to.be.ok;
    expect(remoteRootNode.collapsibleState).to.equal(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    expect(remoteRootNode.children).to.be.ok;
    expect(remoteRootNode.children.length).to.equal(5);

    const ownerListItems = remoteRootNode.children.filter(
      (item) => item.dbItem?.kind === DbItemKind.RemoteOwner,
    );
    expect(ownerListItems.length).to.equal(2);
    checkOwnerItem(ownerListItems[0], "owner1");
    checkOwnerItem(ownerListItems[1], "owner2");
  });

  it("should render repository nodes", async () => {
    const dbConfig: DbConfig = {
      databases: {
        remote: {
          repositoryLists: [],
          owners: [],
          repositories: ["owner1/repo1", "owner1/repo2"],
        },
        local: {
          lists: [],
          databases: [],
        },
      },
    };

    await saveDbConfig(dbConfig);

    const dbTreeItems = await dbTreeDataProvider.getChildren();

    expect(dbTreeItems).to.be.ok;
    const items = dbTreeItems!;
    expect(items.length).to.equal(2);

    const remoteRootNode = items[0];
    expect(remoteRootNode.dbItem).to.be.ok;
    expect(remoteRootNode.collapsibleState).to.equal(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    expect(remoteRootNode.children).to.be.ok;
    expect(remoteRootNode.children.length).to.equal(5);

    const repoItems = remoteRootNode.children.filter(
      (item) => item.dbItem?.kind === DbItemKind.RemoteRepo,
    );
    expect(repoItems.length).to.equal(2);
    checkRemoteRepoItem(repoItems[0], "owner1/repo1");
    checkRemoteRepoItem(repoItems[1], "owner1/repo2");
  });

  it("should render local list nodes", async () => {
    const dbConfig: DbConfig = {
      databases: {
        remote: {
          repositoryLists: [],
          owners: [],
          repositories: [],
        },
        local: {
          lists: [
            {
              name: "my-list-1",
              databases: [
                {
                  name: "db1",
                  dateAdded: 1668428293677,
                  language: "cpp",
                  storagePath: "/path/to/db1/",
                },
                {
                  name: "db2",
                  dateAdded: 1668428472731,
                  language: "cpp",
                  storagePath: "/path/to/db2/",
                },
              ],
            },
            {
              name: "my-list-2",
              databases: [
                {
                  name: "db3",
                  dateAdded: 1668428472731,
                  language: "ruby",
                  storagePath: "/path/to/db3/",
                },
              ],
            },
          ],
          databases: [],
        },
      },
    };

    await saveDbConfig(dbConfig);

    const dbTreeItems = await dbTreeDataProvider.getChildren();

    expect(dbTreeItems).to.be.ok;
    const items = dbTreeItems!;
    expect(items.length).to.equal(2);

    const localRootNode = items[1];
    expect(localRootNode.dbItem).to.be.ok;
    expect(localRootNode.collapsibleState).to.equal(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    expect(localRootNode.children).to.be.ok;
    expect(localRootNode.children.length).to.equal(2);

    const localListItems = localRootNode.children.filter(
      (item) => item.dbItem?.kind === DbItemKind.LocalList,
    );
    expect(localListItems.length).to.equal(2);
    checkLocalListItem(localListItems[0], "my-list-1", [
      {
        kind: DbItemKind.LocalDatabase,
        databaseName: "db1",
        dateAdded: 1668428293677,
        language: "cpp",
        storagePath: "/path/to/db1/",
      },
      {
        kind: DbItemKind.LocalDatabase,
        databaseName: "db2",
        dateAdded: 1668428472731,
        language: "cpp",
        storagePath: "/path/to/db2/",
      },
    ]);
    checkLocalListItem(localListItems[1], "my-list-2", [
      {
        kind: DbItemKind.LocalDatabase,
        databaseName: "db3",
        dateAdded: 1668428472731,
        language: "ruby",
        storagePath: "/path/to/db3/",
      },
    ]);
  });

  it("should render local database nodes", async () => {
    const dbConfig: DbConfig = {
      databases: {
        remote: {
          repositoryLists: [],
          owners: [],
          repositories: [],
        },
        local: {
          lists: [],
          databases: [
            {
              name: "db1",
              dateAdded: 1668428293677,
              language: "csharp",
              storagePath: "/path/to/db1/",
            },
            {
              name: "db2",
              dateAdded: 1668428472731,
              language: "go",
              storagePath: "/path/to/db2/",
            },
          ],
        },
      },
    };

    await saveDbConfig(dbConfig);

    const dbTreeItems = await dbTreeDataProvider.getChildren();

    expect(dbTreeItems).to.be.ok;
    const items = dbTreeItems!;
    expect(items.length).to.equal(2);

    const localRootNode = items[1];
    expect(localRootNode.dbItem).to.be.ok;
    expect(localRootNode.collapsibleState).to.equal(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    expect(localRootNode.children).to.be.ok;
    expect(localRootNode.children.length).to.equal(2);

    const localDatabaseItems = localRootNode.children.filter(
      (item) => item.dbItem?.kind === DbItemKind.LocalDatabase,
    );
    expect(localDatabaseItems.length).to.equal(2);
    checkLocalDatabaseItem(localDatabaseItems[0], {
      kind: DbItemKind.LocalDatabase,
      databaseName: "db1",
      dateAdded: 1668428293677,
      language: "csharp",
      storagePath: "/path/to/db1/",
    });
    checkLocalDatabaseItem(localDatabaseItems[1], {
      kind: DbItemKind.LocalDatabase,
      databaseName: "db2",
      dateAdded: 1668428472731,
      language: "go",
      storagePath: "/path/to/db2/",
    });
  });

  async function saveDbConfig(dbConfig: DbConfig): Promise<void> {
    await fs.writeJson(dbConfigFilePath, dbConfig);

    // Ideally we would just initialise the db config store at the start
    // of each test and then rely on the file watcher to update the config.
    // However, this requires adding sleep to the tests to allow for the
    // file watcher to catch up, so we instead initialise the config store here.
    await dbConfigStore.initialize();
    dbTreeDataProvider = new DbTreeDataProvider(dbManager);
  }

  function checkRemoteSystemDefinedListItem(
    item: DbTreeViewItem,
    n: number,
  ): void {
    expect(item.label).to.equal(`Top ${n} repositories`);
    expect(item.tooltip).to.equal(`Top ${n} repositories of a language`);
    expect(item.iconPath).to.deep.equal(new vscode.ThemeIcon("github"));
    expect(item.collapsibleState).to.equal(
      vscode.TreeItemCollapsibleState.None,
    );
  }

  function checkUserDefinedListItem(
    item: DbTreeViewItem,
    listName: string,
    repos: string[],
  ): void {
    expect(item.label).to.equal(listName);
    expect(item.tooltip).to.be.undefined;
    expect(item.iconPath).to.be.undefined;
    expect(item.collapsibleState).to.equal(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    expect(item.children).to.be.ok;
    expect(item.children.length).to.equal(repos.length);

    for (let i = 0; i < repos.length; i++) {
      checkRemoteRepoItem(item.children[i], repos[i]);
    }
  }

  function checkOwnerItem(item: DbTreeViewItem, ownerName: string): void {
    expect(item.label).to.equal(ownerName);
    expect(item.tooltip).to.be.undefined;
    expect(item.iconPath).to.deep.equal(new vscode.ThemeIcon("organization"));
    expect(item.collapsibleState).to.equal(
      vscode.TreeItemCollapsibleState.None,
    );
    expect(item.children).to.be.ok;
    expect(item.children.length).to.equal(0);
  }

  function checkRemoteRepoItem(item: DbTreeViewItem, repoName: string): void {
    expect(item.label).to.equal(repoName);
    expect(item.tooltip).to.be.undefined;
    expect(item.iconPath).to.deep.equal(new vscode.ThemeIcon("database"));
    expect(item.collapsibleState).to.equal(
      vscode.TreeItemCollapsibleState.None,
    );
  }

  function checkLocalListItem(
    item: DbTreeViewItem,
    listName: string,
    databases: LocalDatabaseDbItem[],
  ): void {
    expect(item.label).to.equal(listName);
    expect(item.tooltip).to.be.undefined;
    expect(item.iconPath).to.be.undefined;
    expect(item.collapsibleState).to.equal(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    expect(item.children).to.be.ok;
    expect(item.children.length).to.equal(databases.length);

    for (let i = 0; i < databases.length; i++) {
      checkLocalDatabaseItem(item.children[i], databases[i]);
    }
  }

  function checkLocalDatabaseItem(
    item: DbTreeViewItem,
    database: LocalDatabaseDbItem,
  ): void {
    expect(item.label).to.equal(database.databaseName);
    expect(item.tooltip).to.equal(`Language: ${database.language}`);
    expect(item.iconPath).to.deep.equal(new vscode.ThemeIcon("database"));
    expect(item.collapsibleState).to.equal(
      vscode.TreeItemCollapsibleState.None,
    );
  }
});
