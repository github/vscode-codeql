import { TreeItemCollapsibleState, ThemeIcon } from "vscode";
import { join } from "path";
import { ensureDir, remove, writeJson } from "fs-extra";
import { DbConfig } from "../../../../src/databases/config/db-config";
import { DbManager } from "../../../../src/databases/db-manager";
import { DbConfigStore } from "../../../../src/databases/config/db-config-store";
import { DbTreeDataProvider } from "../../../../src/databases/ui/db-tree-data-provider";
import {
  DbItemKind,
  LocalDatabaseDbItem,
} from "../../../../src/databases/db-item";
import { DbTreeViewItem } from "../../../../src/databases/ui/db-tree-view-item";
import { ExtensionApp } from "../../../../src/common/vscode/vscode-app";
import { createMockExtensionContext } from "../../../factories/extension-context";
import { createDbConfig } from "../../../factories/db-config-factories";
import { setRemoteControllerRepo } from "../../../../src/config";

describe("db panel rendering nodes", () => {
  const workspaceStoragePath = join(__dirname, "test-workspace-storage");
  const globalStoragePath = join(__dirname, "test-global-storage");
  const extensionPath = join(__dirname, "../../../../");
  const dbConfigFilePath = join(
    workspaceStoragePath,
    DbConfigStore.databaseConfigFileName,
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
    await ensureDir(workspaceStoragePath);

    const app = new ExtensionApp(extensionContext);

    dbConfigStore = new DbConfigStore(app, false);
    dbManager = new DbManager(app, dbConfigStore);
  });

  beforeEach(async () => {
    await ensureDir(workspaceStoragePath);
  });

  afterEach(async () => {
    await remove(workspaceStoragePath);
  });

  describe("when controller repo is not set", () => {
    beforeEach(async () => {
      await setRemoteControllerRepo(undefined);
    });

    it("should not have any items", async () => {
      const dbConfig: DbConfig = createDbConfig({
        remoteLists: [
          {
            name: "my-list-1",
            repositories: ["owner1/repo1", "owner1/repo2"],
          },
          {
            name: "my-list-2",
            repositories: ["owner2/repo1", "owner2/repo2"],
          },
        ],
      });

      await saveDbConfig(dbConfig);

      const dbTreeItems = await dbTreeDataProvider.getChildren();

      expect(dbTreeItems).toHaveLength(0);
    });
  });

  describe("when controller repo is set", () => {
    beforeEach(async () => {
      await setRemoteControllerRepo("github/codeql");
    });

    it("should render default remote nodes when the config is empty", async () => {
      const dbConfig: DbConfig = createDbConfig();

      await saveDbConfig(dbConfig);

      const dbTreeItems = await dbTreeDataProvider.getChildren();

      expect(dbTreeItems).toBeTruthy();
      const items = dbTreeItems!;
      expect(items.length).toBe(3);

      checkRemoteSystemDefinedListItem(items[0], 10);
      checkRemoteSystemDefinedListItem(items[1], 100);
      checkRemoteSystemDefinedListItem(items[2], 1000);
    });

    it("should render remote repository list nodes", async () => {
      const dbConfig: DbConfig = createDbConfig({
        remoteLists: [
          {
            name: "my-list-1",
            repositories: ["owner1/repo1", "owner1/repo2"],
          },
          {
            name: "my-list-2",
            repositories: ["owner1/repo1", "owner2/repo1", "owner2/repo2"],
          },
        ],
      });

      await saveDbConfig(dbConfig);

      const dbTreeItems = await dbTreeDataProvider.getChildren();
      expect(dbTreeItems).toBeTruthy();

      const systemDefinedListItems = dbTreeItems!.filter(
        (item) => item.dbItem?.kind === DbItemKind.RemoteSystemDefinedList,
      );
      expect(systemDefinedListItems.length).toBe(3);

      const userDefinedListItems = dbTreeItems!.filter(
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
      const dbConfig: DbConfig = createDbConfig({
        remoteOwners: ["owner1", "owner2"],
      });

      await saveDbConfig(dbConfig);

      const dbTreeItems = await dbTreeDataProvider.getChildren();
      expect(dbTreeItems).toBeTruthy();
      expect(dbTreeItems?.length).toBe(5);

      const ownerListItems = dbTreeItems!.filter(
        (item) => item.dbItem?.kind === DbItemKind.RemoteOwner,
      );
      expect(ownerListItems.length).toBe(2);
      checkOwnerItem(ownerListItems[0], "owner1");
      checkOwnerItem(ownerListItems[1], "owner2");
    });

    it("should render repository nodes", async () => {
      const dbConfig: DbConfig = createDbConfig({
        remoteRepos: ["owner1/repo1", "owner1/repo2"],
      });

      await saveDbConfig(dbConfig);

      const dbTreeItems = await dbTreeDataProvider.getChildren();
      expect(dbTreeItems).toBeTruthy();
      expect(dbTreeItems!.length).toBe(5);

      const repoItems = dbTreeItems!.filter(
        (item) => item.dbItem?.kind === DbItemKind.RemoteRepo,
      );
      expect(repoItems.length).toBe(2);
      checkRemoteRepoItem(repoItems[0], "owner1/repo1");
      checkRemoteRepoItem(repoItems[1], "owner1/repo2");
    });

    it.skip("should render local list nodes", async () => {
      const dbConfig: DbConfig = createDbConfig({
        localLists: [
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
      });

      await saveDbConfig(dbConfig);

      const dbTreeItems = await dbTreeDataProvider.getChildren();
      expect(dbTreeItems).toBeTruthy();

      const localRootNode = dbTreeItems?.find(
        (i) => i.dbItem?.kind === DbItemKind.RootLocal,
      );
      expect(localRootNode).toBeTruthy();

      expect(localRootNode!.dbItem).toBeTruthy();
      expect(localRootNode!.collapsibleState).toBe(
        TreeItemCollapsibleState.Collapsed,
      );
      expect(localRootNode!.children).toBeTruthy();
      expect(localRootNode!.children.length).toBe(2);

      const localListItems = localRootNode!.children.filter(
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

    it.skip("should render local database nodes", async () => {
      const dbConfig: DbConfig = createDbConfig({
        localDbs: [
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
      });

      await saveDbConfig(dbConfig);

      const dbTreeItems = await dbTreeDataProvider.getChildren();

      expect(dbTreeItems).toBeTruthy();
      const localRootNode = dbTreeItems?.find(
        (i) => i.dbItem?.kind === DbItemKind.RootLocal,
      );
      expect(localRootNode).toBeTruthy();

      expect(localRootNode!.dbItem).toBeTruthy();
      expect(localRootNode!.collapsibleState).toBe(
        TreeItemCollapsibleState.Collapsed,
      );
      expect(localRootNode!.children).toBeTruthy();
      expect(localRootNode!.children.length).toBe(2);

      const localDatabaseItems = localRootNode!.children.filter(
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
  });

  async function saveDbConfig(dbConfig: DbConfig): Promise<void> {
    await writeJson(dbConfigFilePath, dbConfig);

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
    expect(item.iconPath).toEqual(new ThemeIcon("github"));
    expect(item.collapsibleState).toBe(TreeItemCollapsibleState.None);
    checkDbItemActions(item, ["canBeSelected"]);
  }

  function checkUserDefinedListItem(
    item: DbTreeViewItem,
    listName: string,
    repos: string[],
  ): void {
    expect(item.label).toBe(listName);
    expect(item.tooltip).toBeUndefined();
    expect(item.iconPath).toBeUndefined();
    expect(item.collapsibleState).toBe(TreeItemCollapsibleState.Collapsed);
    checkDbItemActions(item, ["canBeSelected", "canBeRenamed", "canBeRemoved"]);
    expect(item.children).toBeTruthy();
    expect(item.children.length).toBe(repos.length);

    for (let i = 0; i < repos.length; i++) {
      checkRemoteRepoItem(item.children[i], repos[i]);
    }
  }

  function checkOwnerItem(item: DbTreeViewItem, ownerName: string): void {
    expect(item.label).toBe(ownerName);
    expect(item.tooltip).toBeUndefined();
    expect(item.iconPath).toEqual(new ThemeIcon("organization"));
    expect(item.collapsibleState).toBe(TreeItemCollapsibleState.None);
    checkDbItemActions(item, [
      "canBeSelected",
      "canBeRemoved",
      "canBeOpenedOnGitHub",
    ]);
    expect(item.children).toBeTruthy();
    expect(item.children.length).toBe(0);
  }

  function checkRemoteRepoItem(item: DbTreeViewItem, repoName: string): void {
    expect(item.label).toBe(repoName);
    expect(item.tooltip).toBeUndefined();
    expect(item.iconPath).toEqual(new ThemeIcon("cloud"));
    expect(item.collapsibleState).toBe(TreeItemCollapsibleState.None);
    checkDbItemActions(item, [
      "canBeSelected",
      "canBeRemoved",
      "canBeOpenedOnGitHub",
    ]);
  }

  function checkLocalListItem(
    item: DbTreeViewItem,
    listName: string,
    databases: LocalDatabaseDbItem[],
  ): void {
    expect(item.label).toBe(listName);
    expect(item.tooltip).toBeUndefined();
    expect(item.iconPath).toBeUndefined();
    expect(item.collapsibleState).toBe(TreeItemCollapsibleState.Collapsed);
    checkDbItemActions(item, ["canBeSelected", "canBeRemoved", "canBeRenamed"]);
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
    expect(item.iconPath).toEqual(new ThemeIcon("database"));
    expect(item.collapsibleState).toBe(TreeItemCollapsibleState.None);
    checkDbItemActions(item, ["canBeSelected", "canBeRemoved", "canBeRenamed"]);
  }

  function checkDbItemActions(item: DbTreeViewItem, actions: string[]): void {
    const itemActions = item.contextValue?.split(",");
    expect(itemActions).toBeDefined();
    expect(itemActions!.length).toBe(actions.length);
    for (const action of actions) {
      expect(itemActions).toContain(action);
    }
  }
});
