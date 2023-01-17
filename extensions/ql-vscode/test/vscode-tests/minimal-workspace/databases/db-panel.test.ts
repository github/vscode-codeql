import { TreeItemCollapsibleState, ThemeIcon, ThemeColor } from "vscode";
import { join } from "path";
import { ensureDir, readJSON, remove, writeJson } from "fs-extra";
import {
  DbConfig,
  SelectedDbItemKind,
} from "../../../../src/databases/config/db-config";
import { DbManager } from "../../../../src/databases/db-manager";
import { DbConfigStore } from "../../../../src/databases/config/db-config-store";
import { DbTreeDataProvider } from "../../../../src/databases/ui/db-tree-data-provider";
import {
  DbItemKind,
  DbListKind,
  LocalDatabaseDbItem,
} from "../../../../src/databases/db-item";
import {
  DbTreeViewItem,
  SELECTED_DB_ITEM_RESOURCE_URI,
} from "../../../../src/databases/ui/db-tree-view-item";
import { ExtensionApp } from "../../../../src/common/vscode/vscode-app";
import { createMockExtensionContext } from "../../../factories/extension-context";
import { createDbConfig } from "../../../factories/db-config-factories";

describe("db panel", () => {
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

  describe("rendering nodes", () => {
    it("should render default local and remote nodes when the config is empty", async () => {
      const dbConfig: DbConfig = createDbConfig();

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
        TreeItemCollapsibleState.Collapsed,
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
        TreeItemCollapsibleState.Collapsed,
      );
      expect(localRootNode.children).toBeTruthy();
      expect(localRootNode.children.length).toBe(0);
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
      const items = dbTreeItems!;
      expect(items.length).toBe(2);

      const remoteRootNode = items[0];
      expect(remoteRootNode.dbItem).toBeTruthy();
      expect(remoteRootNode.collapsibleState).toBe(
        TreeItemCollapsibleState.Collapsed,
      );
      expect(remoteRootNode.children).toBeTruthy();
      expect(remoteRootNode.children.length).toBe(5);

      const systemDefinedListItems = remoteRootNode.children.filter(
        (item) => item.dbItem?.kind === DbItemKind.RemoteSystemDefinedList,
      );
      expect(systemDefinedListItems.length).toBe(3);

      const userDefinedListItems = remoteRootNode.children.filter(
        (item) =>
          item.dbItem?.kind === DbItemKind.VariantAnalysisUserDefinedList,
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
      const items = dbTreeItems!;
      expect(items.length).toBe(2);

      const remoteRootNode = items[0];
      expect(remoteRootNode.dbItem).toBeTruthy();
      expect(remoteRootNode.collapsibleState).toBe(
        TreeItemCollapsibleState.Collapsed,
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
      const dbConfig: DbConfig = createDbConfig({
        remoteRepos: ["owner1/repo1", "owner1/repo2"],
      });

      await saveDbConfig(dbConfig);

      const dbTreeItems = await dbTreeDataProvider.getChildren();

      expect(dbTreeItems).toBeTruthy();
      const items = dbTreeItems!;
      expect(items.length).toBe(2);

      const remoteRootNode = items[0];
      expect(remoteRootNode.dbItem).toBeTruthy();
      expect(remoteRootNode.collapsibleState).toBe(
        TreeItemCollapsibleState.Collapsed,
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
      const items = dbTreeItems!;
      expect(items.length).toBe(2);

      const localRootNode = items[1];
      expect(localRootNode.dbItem).toBeTruthy();
      expect(localRootNode.collapsibleState).toBe(
        TreeItemCollapsibleState.Collapsed,
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
      const items = dbTreeItems!;
      expect(items.length).toBe(2);

      const localRootNode = items[1];
      expect(localRootNode.dbItem).toBeTruthy();
      expect(localRootNode.collapsibleState).toBe(
        TreeItemCollapsibleState.Collapsed,
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
  });

  describe("selecting an item", () => {
    it("should mark selected remote db list as selected", async () => {
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
        selected: {
          kind: SelectedDbItemKind.VariantAnalysisUserDefinedList,
          listName: "my-list-2",
        },
      });

      await saveDbConfig(dbConfig);

      const dbTreeItems = await dbTreeDataProvider.getChildren();

      expect(dbTreeItems).toBeTruthy();
      const items = dbTreeItems!;

      const remoteRootNode = items[0];
      expect(remoteRootNode.dbItem).toBeTruthy();
      expect(remoteRootNode.dbItem?.kind).toEqual(DbItemKind.RootRemote);

      const list1 = remoteRootNode.children.find(
        (c) =>
          c.dbItem?.kind === DbItemKind.VariantAnalysisUserDefinedList &&
          c.dbItem?.listName === "my-list-1",
      );
      const list2 = remoteRootNode.children.find(
        (c) =>
          c.dbItem?.kind === DbItemKind.VariantAnalysisUserDefinedList &&
          c.dbItem?.listName === "my-list-2",
      );

      expect(list1).toBeTruthy();
      expect(list2).toBeTruthy();
      expect(isTreeViewItemSelectable(list1!)).toBeTruthy();
      expect(isTreeViewItemSelected(list2!)).toBeTruthy();
    });

    it("should mark selected remote db inside list as selected", async () => {
      const dbConfig: DbConfig = createDbConfig({
        remoteLists: [
          {
            name: "my-list-1",
            repositories: ["owner1/repo1", "owner1/repo2"],
          },
          {
            name: "my-list-2",
            repositories: ["owner1/repo1", "owner2/repo2"],
          },
        ],
        remoteRepos: ["owner1/repo1"],
        selected: {
          kind: SelectedDbItemKind.VariantAnalysisRepository,
          repositoryName: "owner1/repo1",
          listName: "my-list-2",
        },
      });

      await saveDbConfig(dbConfig);

      const dbTreeItems = await dbTreeDataProvider.getChildren();

      expect(dbTreeItems).toBeTruthy();
      const items = dbTreeItems!;

      const remoteRootNode = items[0];
      expect(remoteRootNode.dbItem).toBeTruthy();
      expect(remoteRootNode.dbItem?.kind).toEqual(DbItemKind.RootRemote);

      const list2 = remoteRootNode.children.find(
        (c) =>
          c.dbItem?.kind === DbItemKind.VariantAnalysisUserDefinedList &&
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
  });

  describe("addNewRemoteRepo", () => {
    it("should add a new remote repo", async () => {
      const dbConfig: DbConfig = createDbConfig({
        remoteRepos: ["owner1/repo1"],
      });

      await saveDbConfig(dbConfig);

      const dbTreeItems = await dbTreeDataProvider.getChildren();

      expect(dbTreeItems).toBeTruthy();
      const items = dbTreeItems!;

      const remoteRootNode = items[0];
      const remoteRepos = remoteRootNode.children.filter(
        (c) => c.dbItem?.kind === DbItemKind.RemoteRepo,
      );
      const repo1 = remoteRootNode.children.find(
        (c) =>
          c.dbItem?.kind === DbItemKind.RemoteRepo &&
          c.dbItem?.repoFullName === "owner1/repo1",
      );

      expect(remoteRepos.length).toBe(1);
      expect(remoteRepos[0]).toBe(repo1);

      await dbManager.addNewRemoteRepo("owner2/repo2");

      const dbConfigFileContents = await readDbConfigDirectly();
      expect(
        dbConfigFileContents.databases.variantAnalysis.repositories.length,
      ).toBe(2);
      expect(
        dbConfigFileContents.databases.variantAnalysis.repositories[1],
      ).toEqual("owner2/repo2");
    });

    it("should add a new remote repo to a user defined list", async () => {
      const dbConfig: DbConfig = createDbConfig({
        remoteLists: [
          {
            name: "my-list-1",
            repositories: ["owner1/repo1"],
          },
        ],
        remoteRepos: ["owner2/repo2"],
      });

      await saveDbConfig(dbConfig);

      const dbTreeItems = await dbTreeDataProvider.getChildren();

      expect(dbTreeItems).toBeTruthy();
      const items = dbTreeItems!;

      const remoteRootNode = items[0];
      const remoteUserDefinedLists = remoteRootNode.children.filter(
        (c) => c.dbItem?.kind === DbItemKind.VariantAnalysisUserDefinedList,
      );
      const list1 = remoteRootNode.children.find(
        (c) =>
          c.dbItem?.kind === DbItemKind.VariantAnalysisUserDefinedList &&
          c.dbItem?.listName === "my-list-1",
      );

      expect(remoteUserDefinedLists.length).toBe(1);
      expect(remoteUserDefinedLists[0]).toBe(list1);

      await dbManager.addNewRemoteRepo("owner2/repo2", "my-list-1");

      // Read the workspace databases JSON file directly to check that the new repo has been added.
      // We can't use the dbConfigStore's `read` function here because it depends on the file watcher
      // picking up changes, and we don't control the timing of that.
      const dbConfigFileContents = await readJSON(dbConfigFilePath);
      expect(
        dbConfigFileContents.databases.variantAnalysis.repositoryLists.length,
      ).toBe(1);

      expect(
        dbConfigFileContents.databases.variantAnalysis.repositoryLists[0],
      ).toEqual({
        name: "my-list-1",
        repositories: ["owner1/repo1", "owner2/repo2"],
      });
    });
  });

  describe("addNewList", () => {
    it("should add a new remote list", async () => {
      const dbConfig: DbConfig = createDbConfig({
        remoteLists: [
          {
            name: "my-list-1",
            repositories: ["owner1/repo1", "owner1/repo2"],
          },
        ],
        selected: {
          kind: SelectedDbItemKind.VariantAnalysisUserDefinedList,
          listName: "my-list-1",
        },
      });

      await saveDbConfig(dbConfig);

      const dbTreeItems = await dbTreeDataProvider.getChildren();

      expect(dbTreeItems).toBeTruthy();
      const items = dbTreeItems!;

      const remoteRootNode = items[0];
      const remoteUserDefinedLists = remoteRootNode.children.filter(
        (c) => c.dbItem?.kind === DbItemKind.VariantAnalysisUserDefinedList,
      );
      const list1 = remoteRootNode.children.find(
        (c) =>
          c.dbItem?.kind === DbItemKind.VariantAnalysisUserDefinedList &&
          c.dbItem?.listName === "my-list-1",
      );

      expect(remoteUserDefinedLists.length).toBe(1);
      expect(remoteUserDefinedLists[0]).toBe(list1);

      await dbManager.addNewList(DbListKind.Remote, "my-list-2");

      const dbConfigFileContents = await readDbConfigDirectly();
      expect(
        dbConfigFileContents.databases.variantAnalysis.repositoryLists.length,
      ).toBe(2);
      expect(
        dbConfigFileContents.databases.variantAnalysis.repositoryLists[1],
      ).toEqual({
        name: "my-list-2",
        repositories: [],
      });
    });

    it("should throw error when adding a new list to a local node", async () => {
      const dbConfig: DbConfig = createDbConfig({
        localLists: [
          {
            name: "my-list-1",
            databases: [],
          },
        ],
      });
      await saveDbConfig(dbConfig);

      const dbTreeItems = await dbTreeDataProvider.getChildren();

      expect(dbTreeItems).toBeTruthy();
      const items = dbTreeItems!;

      const localRootNode = items[1];
      const localUserDefinedLists = localRootNode.children.filter(
        (c) => c.dbItem?.kind === DbItemKind.LocalList,
      );
      const list1 = localRootNode.children.find(
        (c) =>
          c.dbItem?.kind === DbItemKind.LocalList &&
          c.dbItem?.listName === "my-list-1",
      );

      expect(localUserDefinedLists.length).toBe(1);
      expect(localUserDefinedLists[0]).toBe(list1);

      await dbManager.addNewList(DbListKind.Local, "my-list-2");

      const dbConfigFileContents = await readDbConfigDirectly();
      expect(dbConfigFileContents.databases.local.lists.length).toBe(2);
      expect(dbConfigFileContents.databases.local.lists[1]).toEqual({
        name: "my-list-2",
        databases: [],
      });
    });
  });

  describe("config errors", () => {
    it("should show error for invalid config", async () => {
      // We're intentionally bypassing the type check because we'd
      // like to make sure validation errors are highlighted.
      const dbConfig = {
        databases: {},
      } as any as DbConfig;

      await saveDbConfig(dbConfig);

      const dbTreeItems = await dbTreeDataProvider.getChildren();

      expect(dbTreeItems).toBeTruthy();
      const items = dbTreeItems!;
      expect(items.length).toBe(1);

      checkErrorItem(
        items[0],
        "Error when reading databases config",
        "Please open your databases config and address errors",
      );
    });

    it("should show errors for duplicate names", async () => {
      const dbConfig: DbConfig = createDbConfig({
        remoteLists: [
          {
            name: "my-list-1",
            repositories: ["owner1/repo1", "owner1/repo2"],
          },
          {
            name: "my-list-1",
            repositories: ["owner1/repo1", "owner2/repo2"],
          },
        ],
        remoteRepos: ["owner1/repo1", "owner1/repo1"],
      });

      await saveDbConfig(dbConfig);

      const dbTreeItems = await dbTreeDataProvider.getChildren();

      expect(dbTreeItems).toBeTruthy();
      const items = dbTreeItems!;
      expect(items.length).toBe(2);

      checkErrorItem(
        items[0],
        "There are database lists with the same name: my-list-1",
        "Please remove duplicates",
      );
      checkErrorItem(
        items[1],
        "There are databases with the same name: owner1/repo1",
        "Please remove duplicates",
      );
    });
  });

  describe("name validation", () => {
    it("should not allow adding a new list with empty name", async () => {
      const dbConfig = createDbConfig();

      await saveDbConfig(dbConfig);

      await expect(dbManager.addNewList(DbListKind.Remote, "")).rejects.toThrow(
        new Error("List name cannot be empty"),
      );
    });

    it("should not allow adding a list with duplicate name", async () => {
      const dbConfig = createDbConfig({
        remoteLists: [
          {
            name: "my-list-1",
            repositories: ["owner1/repo1", "owner1/repo2"],
          },
        ],
      });

      await saveDbConfig(dbConfig);

      await expect(
        dbManager.addNewList(DbListKind.Remote, "my-list-1"),
      ).rejects.toThrow(
        new Error("A remote list with the name 'my-list-1' already exists"),
      );
    });

    it("should not allow adding a new remote db with empty name", async () => {
      const dbConfig = createDbConfig();

      await saveDbConfig(dbConfig);

      await expect(dbManager.addNewRemoteRepo("")).rejects.toThrow(
        new Error("Repository name cannot be empty"),
      );
    });

    it("should not allow adding a remote db with duplicate name", async () => {
      const dbConfig = createDbConfig({
        remoteRepos: ["owner1/repo1"],
      });

      await saveDbConfig(dbConfig);

      await expect(dbManager.addNewRemoteRepo("owner1/repo1")).rejects.toThrow(
        new Error(
          "A remote repository with the name 'owner1/repo1' already exists",
        ),
      );
    });

    it("should not allow adding a new remote owner with empty name", async () => {
      const dbConfig = createDbConfig();

      await saveDbConfig(dbConfig);

      await expect(dbManager.addNewRemoteOwner("")).rejects.toThrow(
        new Error("Owner name cannot be empty"),
      );
    });

    it("should not allow adding a remote owner with duplicate name", async () => {
      const dbConfig = createDbConfig({
        remoteOwners: ["owner1"],
      });

      await saveDbConfig(dbConfig);

      await expect(dbManager.addNewRemoteOwner("owner1")).rejects.toThrow(
        new Error("A remote owner with the name 'owner1' already exists"),
      );
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
    expect(item.iconPath).toEqual(new ThemeIcon("database"));
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

  function checkErrorItem(
    item: DbTreeViewItem,
    label: string,
    tooltip: string,
  ): void {
    expect(item.dbItem).toBe(undefined);
    expect(item.iconPath).toEqual(
      new ThemeIcon("error", new ThemeColor("problemsErrorIcon.foreground")),
    );
    expect(item.label).toBe(label);
    expect(item.tooltip).toBe(tooltip);
    expect(item.collapsibleState).toBe(TreeItemCollapsibleState.None);
    expect(item.children.length).toBe(0);
  }

  function isTreeViewItemSelectable(treeViewItem: DbTreeViewItem) {
    return (
      treeViewItem.resourceUri === undefined &&
      treeViewItem.contextValue?.includes("canBeSelected")
    );
  }

  function isTreeViewItemSelected(treeViewItem: DbTreeViewItem) {
    return (
      treeViewItem.resourceUri?.toString(true) ===
        SELECTED_DB_ITEM_RESOURCE_URI &&
      (treeViewItem.contextValue === undefined ||
        !treeViewItem.contextValue.includes("canBeSelected"))
    );
  }

  async function readDbConfigDirectly(): Promise<DbConfig> {
    // Read the workspace databases JSON file directly to check that the new list has been added.
    // We can't use the dbConfigStore's `read` function here because it depends on the file watcher
    // picking up changes, and we don't control the timing of that.
    return (await readJSON(dbConfigFilePath)) as DbConfig;
  }
});
