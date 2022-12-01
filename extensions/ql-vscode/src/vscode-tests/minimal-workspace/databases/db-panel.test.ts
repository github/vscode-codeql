import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs-extra";
import {
  DbConfig,
  SelectedDbItemKind,
} from "../../../databases/config/db-config";
import { DbManager } from "../../../databases/db-manager";
import { DbConfigStore } from "../../../databases/config/db-config-store";
import { DbTreeDataProvider } from "../../../databases/ui/db-tree-data-provider";
import { DbItemKind, LocalDatabaseDbItem } from "../../../databases/db-item";
import { DbTreeViewItem } from "../../../databases/ui/db-tree-view-item";
import { ExtensionApp } from "../../../common/vscode/vscode-app";
import { createMockExtensionContext } from "../../factories/extension-context";

describe("db panel", () => {
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

  beforeAll(async () => {
    const extensionContext = createMockExtensionContext({
      extensionPath,
      globalStoragePath,
      workspaceStoragePath,
    });
    await fs.ensureDir(workspaceStoragePath);

    const app = new ExtensionApp(extensionContext);

    dbConfigStore = new DbConfigStore(app);
    dbManager = new DbManager(app, dbConfigStore);
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

    expect(dbTreeItems).toBeTruthy();
    const items = dbTreeItems!;
    expect(items.length).toBe(2);

    const remoteRootNode = items[0];
    expect(remoteRootNode.dbItem).toBeTruthy();
    expect(remoteRootNode.dbItem?.kind).toBe(DbItemKind.RootRemote);
    expect(remoteRootNode.label).toBe("remote");
    expect(remoteRootNode.tooltip).toBe("Remote databases");
    expect(remoteRootNode.collapsibleState).toBe(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    expect(remoteRootNode.children).toBeTruthy();
    expect(remoteRootNode.children.length).toBe(3);

    const systemDefinedListItems = remoteRootNode.children.filter(
      (item) => item.dbItem?.kind === DbItemKind.RemoteSystemDefinedList,
    );
    expect(systemDefinedListItems.length).toBe(3);
    checkRemoteSystemDefinedListItem(systemDefinedListItems[0], 10);
    checkRemoteSystemDefinedListItem(systemDefinedListItems[1], 100);
    checkRemoteSystemDefinedListItem(systemDefinedListItems[2], 1000);

    const localRootNode = items[1];
    expect(localRootNode.dbItem).toBeTruthy();
    expect(localRootNode.dbItem?.kind).toBe(DbItemKind.RootLocal);
    expect(localRootNode.label).toBe("local");
    expect(localRootNode.tooltip).toBe("Local databases");
    expect(localRootNode.collapsibleState).toBe(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    expect(localRootNode.children).toBeTruthy();
    expect(localRootNode.children.length).toBe(0);
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

    expect(dbTreeItems).toBeTruthy();
    const items = dbTreeItems!;
    expect(items.length).toBe(2);

    const remoteRootNode = items[0];
    expect(remoteRootNode.dbItem).toBeTruthy();
    expect(remoteRootNode.collapsibleState).toBe(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    expect(remoteRootNode.children).toBeTruthy();
    expect(remoteRootNode.children.length).toBe(5);

    const systemDefinedListItems = remoteRootNode.children.filter(
      (item) => item.dbItem?.kind === DbItemKind.RemoteSystemDefinedList,
    );
    expect(systemDefinedListItems.length).toBe(3);

    const userDefinedListItems = remoteRootNode.children.filter(
      (item) => item.dbItem?.kind === DbItemKind.RemoteUserDefinedList,
    );
    expect(userDefinedListItems.length).toBe(2);
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

    expect(dbTreeItems).toBeTruthy();
    const items = dbTreeItems!;
    expect(items.length).toBe(2);

    const remoteRootNode = items[0];
    expect(remoteRootNode.dbItem).toBeTruthy();
    expect(remoteRootNode.collapsibleState).toBe(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    expect(remoteRootNode.children).toBeTruthy();
    expect(remoteRootNode.children.length).toBe(5);

    const ownerListItems = remoteRootNode.children.filter(
      (item) => item.dbItem?.kind === DbItemKind.RemoteOwner,
    );
    expect(ownerListItems.length).toBe(2);
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

    expect(dbTreeItems).toBeTruthy();
    const items = dbTreeItems!;
    expect(items.length).toBe(2);

    const remoteRootNode = items[0];
    expect(remoteRootNode.dbItem).toBeTruthy();
    expect(remoteRootNode.collapsibleState).toBe(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    expect(remoteRootNode.children).toBeTruthy();
    expect(remoteRootNode.children.length).toBe(5);

    const repoItems = remoteRootNode.children.filter(
      (item) => item.dbItem?.kind === DbItemKind.RemoteRepo,
    );
    expect(repoItems.length).toBe(2);
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

    expect(dbTreeItems).toBeTruthy();
    const items = dbTreeItems!;
    expect(items.length).toBe(2);

    const localRootNode = items[1];
    expect(localRootNode.dbItem).toBeTruthy();
    expect(localRootNode.collapsibleState).toBe(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    expect(localRootNode.children).toBeTruthy();
    expect(localRootNode.children.length).toBe(2);

    const localListItems = localRootNode.children.filter(
      (item) => item.dbItem?.kind === DbItemKind.LocalList,
    );
    expect(localListItems.length).toBe(2);
    checkLocalListItem(localListItems[0], "my-list-1", [
      {
        kind: DbItemKind.LocalDatabase,
        databaseName: "db1",
        dateAdded: 1668428293677,
        language: "cpp",
        storagePath: "/path/to/db1/",
        selected: false,
      },
      {
        kind: DbItemKind.LocalDatabase,
        databaseName: "db2",
        dateAdded: 1668428472731,
        language: "cpp",
        storagePath: "/path/to/db2/",
        selected: false,
      },
    ]);
    checkLocalListItem(localListItems[1], "my-list-2", [
      {
        kind: DbItemKind.LocalDatabase,
        databaseName: "db3",
        dateAdded: 1668428472731,
        language: "ruby",
        storagePath: "/path/to/db3/",
        selected: false,
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

    expect(dbTreeItems).toBeTruthy();
    const items = dbTreeItems!;
    expect(items.length).toBe(2);

    const localRootNode = items[1];
    expect(localRootNode.dbItem).toBeTruthy();
    expect(localRootNode.collapsibleState).toBe(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    expect(localRootNode.children).toBeTruthy();
    expect(localRootNode.children.length).toBe(2);

    const localDatabaseItems = localRootNode.children.filter(
      (item) => item.dbItem?.kind === DbItemKind.LocalDatabase,
    );
    expect(localDatabaseItems.length).toBe(2);
    checkLocalDatabaseItem(localDatabaseItems[0], {
      kind: DbItemKind.LocalDatabase,
      databaseName: "db1",
      dateAdded: 1668428293677,
      language: "csharp",
      storagePath: "/path/to/db1/",
      selected: false,
    });
    checkLocalDatabaseItem(localDatabaseItems[1], {
      kind: DbItemKind.LocalDatabase,
      databaseName: "db2",
      dateAdded: 1668428472731,
      language: "go",
      storagePath: "/path/to/db2/",
      selected: false,
    });
  });

  it("should mark selected remote db list as selected", async () => {
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
              repositories: ["owner2/repo1", "owner2/repo2"],
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
      selected: {
        kind: SelectedDbItemKind.RemoteUserDefinedList,
        listName: "my-list-2",
      },
    };

    await saveDbConfig(dbConfig);

    const dbTreeItems = await dbTreeDataProvider.getChildren();

    expect(dbTreeItems).toBeTruthy();
    const items = dbTreeItems!;

    const remoteRootNode = items[0];
    expect(remoteRootNode.dbItem).toBeTruthy();
    expect(remoteRootNode.dbItem?.kind).toEqual(DbItemKind.RootRemote);

    const list1 = remoteRootNode.children.find(
      (c) =>
        c.dbItem?.kind === DbItemKind.RemoteUserDefinedList &&
        c.dbItem?.listName === "my-list-1",
    );
    const list2 = remoteRootNode.children.find(
      (c) =>
        c.dbItem?.kind === DbItemKind.RemoteUserDefinedList &&
        c.dbItem?.listName === "my-list-2",
    );

    expect(list1).toBeTruthy();
    expect(list2).toBeTruthy();
    expect(isTreeViewItemSelectable(list1!)).toBeTruthy();
    expect(isTreeViewItemSelected(list2!)).toBeTruthy();
  });

  it("should mark selected remote db inside list as selected", async () => {
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
              repositories: ["owner1/repo1", "owner2/repo2"],
            },
          ],
          owners: [],
          repositories: ["owner1/repo1"],
        },
        local: {
          lists: [],
          databases: [],
        },
      },
      selected: {
        kind: SelectedDbItemKind.RemoteRepository,
        repositoryName: "owner1/repo1",
        listName: "my-list-2",
      },
    };

    await saveDbConfig(dbConfig);

    const dbTreeItems = await dbTreeDataProvider.getChildren();

    expect(dbTreeItems).toBeTruthy();
    const items = dbTreeItems!;

    const remoteRootNode = items[0];
    expect(remoteRootNode.dbItem).toBeTruthy();
    expect(remoteRootNode.dbItem?.kind).toEqual(DbItemKind.RootRemote);

    const list2 = remoteRootNode.children.find(
      (c) =>
        c.dbItem?.kind === DbItemKind.RemoteUserDefinedList &&
        c.dbItem?.listName === "my-list-2",
    );
    expect(list2).toBeTruthy();

    const repo1Node = list2?.children.find(
      (c) =>
        c.dbItem?.kind === DbItemKind.RemoteRepo &&
        c.dbItem?.repoFullName === "owner1/repo1",
    );
    expect(repo1Node).toBeTruthy();
    expect(isTreeViewItemSelected(repo1Node!)).toBeTruthy();

    const repo2Node = list2?.children.find(
      (c) =>
        c.dbItem?.kind === DbItemKind.RemoteRepo &&
        c.dbItem?.repoFullName === "owner2/repo2",
    );
    expect(repo2Node).toBeTruthy();
    expect(isTreeViewItemSelectable(repo2Node!)).toBeTruthy();

    for (const item of remoteRootNode.children) {
      expect(isTreeViewItemSelectable(item)).toBeTruthy();
    }
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
    expect(item.label).toBe(`Top ${n} repositories`);
    expect(item.tooltip).toBe(`Top ${n} repositories of a language`);
    expect(item.iconPath).toEqual(new vscode.ThemeIcon("github"));
    expect(item.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
  }

  function checkUserDefinedListItem(
    item: DbTreeViewItem,
    listName: string,
    repos: string[],
  ): void {
    expect(item.label).toBe(listName);
    expect(item.tooltip).toBeUndefined();
    expect(item.iconPath).toBeUndefined();
    expect(item.collapsibleState).toBe(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    expect(item.children).toBeTruthy();
    expect(item.children.length).toBe(repos.length);

    for (let i = 0; i < repos.length; i++) {
      checkRemoteRepoItem(item.children[i], repos[i]);
    }
  }

  function checkOwnerItem(item: DbTreeViewItem, ownerName: string): void {
    expect(item.label).toBe(ownerName);
    expect(item.tooltip).toBeUndefined();
    expect(item.iconPath).toEqual(new vscode.ThemeIcon("organization"));
    expect(item.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
    expect(item.children).toBeTruthy();
    expect(item.children.length).toBe(0);
  }

  function checkRemoteRepoItem(item: DbTreeViewItem, repoName: string): void {
    expect(item.label).toBe(repoName);
    expect(item.tooltip).toBeUndefined();
    expect(item.iconPath).toEqual(new vscode.ThemeIcon("database"));
    expect(item.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
  }

  function checkLocalListItem(
    item: DbTreeViewItem,
    listName: string,
    databases: LocalDatabaseDbItem[],
  ): void {
    expect(item.label).toBe(listName);
    expect(item.tooltip).toBeUndefined();
    expect(item.iconPath).toBeUndefined();
    expect(item.collapsibleState).toBe(
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    expect(item.children).toBeTruthy();
    expect(item.children.length).toBe(databases.length);

    for (let i = 0; i < databases.length; i++) {
      checkLocalDatabaseItem(item.children[i], databases[i]);
    }
  }

  function checkLocalDatabaseItem(
    item: DbTreeViewItem,
    database: LocalDatabaseDbItem,
  ): void {
    expect(item.label).toBe(database.databaseName);
    expect(item.tooltip).toBe(`Language: ${database.language}`);
    expect(item.iconPath).toEqual(new vscode.ThemeIcon("database"));
    expect(item.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
  }

  function isTreeViewItemSelectable(treeViewItem: DbTreeViewItem) {
    return (
      treeViewItem.resourceUri === undefined &&
      treeViewItem.contextValue === "selectableDbItem"
    );
  }

  function isTreeViewItemSelected(treeViewItem: DbTreeViewItem) {
    return (
      treeViewItem.resourceUri?.query === "selected=true" &&
      treeViewItem.contextValue === undefined
    );
  }
});
