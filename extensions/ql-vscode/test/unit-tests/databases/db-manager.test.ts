import { ensureDir, readJSON, remove, writeJson } from "fs-extra";
import { join } from "path";
import { App } from "../../../src/common/app";
import {
  DbConfig,
  SelectedDbItemKind,
} from "../../../src/databases/config/db-config";
import { DbConfigStore } from "../../../src/databases/config/db-config-store";
import {
  DbListKind,
  flattenDbItems,
  isLocalDatabaseDbItem,
  isLocalListDbItem,
  isRemoteOwnerDbItem,
  isRemoteRepoDbItem,
  isRemoteUserDefinedListDbItem,
  LocalDatabaseDbItem,
  LocalListDbItem,
  RemoteOwnerDbItem,
  RemoteRepoDbItem,
  RemoteUserDefinedListDbItem,
} from "../../../src/databases/db-item";
import {
  ExpandedDbItem,
  ExpandedDbItemKind,
  RemoteUserDefinedListExpandedDbItem,
} from "../../../src/databases/db-item-expansion";
import { DbManager } from "../../../src/databases/db-manager";
import {
  createDbConfig,
  createLocalDbConfigItem,
} from "../../factories/db-config-factories";
import { createRemoteUserDefinedListDbItem } from "../../factories/db-item-factories";
import { createMockApp } from "../../__mocks__/appMock";

// Note: Although these are "unit tests" (i.e. not integrating with VS Code), they do
// test the interaction/"integration" between the DbManager and the DbConfigStore.
describe("db manager", () => {
  let dbManager: DbManager;
  let dbConfigStore: DbConfigStore;
  let tempWorkspaceStoragePath: string;
  let dbConfigFilePath: string;
  let app: App;

  beforeEach(async () => {
    tempWorkspaceStoragePath = join(__dirname, "db-manager-test-workspace");

    const extensionPath = join(__dirname, "../../..");
    app = createMockApp({
      extensionPath,
      workspaceStoragePath: tempWorkspaceStoragePath,
    });

    // We don't need to watch changes to the config file in these tests, so we
    // pass `false` to the dbConfigStore constructor.
    dbConfigStore = new DbConfigStore(app, false);
    dbManager = new DbManager(app, dbConfigStore);
    await ensureDir(tempWorkspaceStoragePath);

    dbConfigFilePath = join(
      tempWorkspaceStoragePath,
      DbConfigStore.databaseConfigFileName,
    );
  });

  afterEach(async () => {
    await remove(tempWorkspaceStoragePath);
    dbConfigStore.dispose();
  });

  describe("adding items", () => {
    describe("adding a remote repo", () => {
      it("should add a new remote repo", async () => {
        const dbConfig: DbConfig = createDbConfig({
          remoteRepos: ["owner1/repo1"],
        });

        await saveDbConfig(dbConfig);

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
        });

        await saveDbConfig(dbConfig);

        await dbManager.addNewRemoteRepo("owner2/repo2", "my-list-1");

        const dbConfigFileContents = await readDbConfigDirectly();
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

        await expect(
          dbManager.addNewRemoteRepo("owner1/repo1"),
        ).rejects.toThrow(
          new Error(
            "A variant analysis repository with the name 'owner1/repo1' already exists",
          ),
        );
      });
    });

    describe("adding a list", () => {
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

        await dbManager.addNewList(DbListKind.Local, "my-list-2");

        const dbConfigFileContents = await readDbConfigDirectly();
        expect(dbConfigFileContents.databases.local.lists.length).toBe(2);
        expect(dbConfigFileContents.databases.local.lists[1]).toEqual({
          name: "my-list-2",
          databases: [],
        });
      });

      it("should not allow adding a new list with empty name", async () => {
        const dbConfig = createDbConfig();

        await saveDbConfig(dbConfig);

        await expect(
          dbManager.addNewList(DbListKind.Remote, ""),
        ).rejects.toThrow(new Error("List name cannot be empty"));
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
          new Error(
            "A variant analysis list with the name 'my-list-1' already exists",
          ),
        );
      });
    });
  });

  describe("adding an owner", () => {
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
        new Error("An owner with the name 'owner1' already exists"),
      );
    });
  });

  describe("renaming items", () => {
    const remoteList = {
      name: "my-list-1",
      repositories: ["owner1/repo1", "owner1/repo2"],
    };
    const localDb = createLocalDbConfigItem({ name: "db1" });
    const localList = {
      name: "my-list-1",
      databases: [localDb],
    };

    it("should rename remote user-defined list", async () => {
      const dbConfig = createDbConfig({
        remoteLists: [remoteList],
        localLists: [localList],
      });

      await saveDbConfig(dbConfig);

      const remoteListDbItems = getRemoteUserDefinedListDbItems("my-list-1");
      expect(remoteListDbItems.length).toEqual(1);

      await dbManager.renameList(remoteListDbItems[0], "my-list-2");

      const dbConfigFileContents = await readDbConfigDirectly();

      // Check that the remote list has been renamed
      const remoteLists =
        dbConfigFileContents.databases.variantAnalysis.repositoryLists;
      expect(remoteLists.length).toBe(1);
      expect(remoteLists[0]).toEqual({
        name: "my-list-2",
        repositories: ["owner1/repo1", "owner1/repo2"],
      });

      // Check that the local list has not been renamed
      const localLists = dbConfigFileContents.databases.local.lists;
      expect(localLists.length).toBe(1);
      expect(localLists[0]).toEqual({
        name: "my-list-1",
        databases: [localDb],
      });
    });

    it("should rename local db list", async () => {
      const dbConfig = createDbConfig({
        remoteLists: [remoteList],
        localLists: [localList],
      });

      await saveDbConfig(dbConfig);

      const localListDbItems = getLocalListDbItems("my-list-1");
      expect(localListDbItems.length).toEqual(1);

      await dbManager.renameList(localListDbItems[0], "my-list-2");

      const dbConfigFileContents = await readDbConfigDirectly();

      // Check that the local list has been renamed
      const localLists = dbConfigFileContents.databases.local.lists;
      expect(localLists.length).toBe(1);
      expect(localLists[0]).toEqual({
        name: "my-list-2",
        databases: [localDb],
      });

      // Check that the remote list has not been renamed
      const remoteLists =
        dbConfigFileContents.databases.variantAnalysis.repositoryLists;
      expect(remoteLists.length).toBe(1);
      expect(remoteLists[0]).toEqual({
        name: "my-list-1",
        repositories: ["owner1/repo1", "owner1/repo2"],
      });
    });

    it("should rename local db outside a list", async () => {
      const dbConfig = createDbConfig({
        localLists: [localList],
        localDbs: [localDb],
      });

      await saveDbConfig(dbConfig);

      const localDbItems = getLocalDatabaseDbItems("db1");
      expect(localDbItems.length).toEqual(1);

      await dbManager.renameLocalDb(localDbItems[0], "db2");

      const dbConfigFileContents = await readDbConfigDirectly();

      // Check that the db outside of the list has been renamed
      const localDbs = dbConfigFileContents.databases.local.databases;
      expect(localDbs.length).toBe(1);
      expect(localDbs[0].name).toEqual("db2");

      // Check that the db inside the list has not been renamed
      const localLists = dbConfigFileContents.databases.local.lists;
      expect(localLists.length).toBe(1);
      expect(localLists[0]).toEqual({
        name: "my-list-1",
        databases: [localDb],
      });
    });

    it("should rename local db inside a list", async () => {
      const dbConfig = createDbConfig({
        localLists: [localList],
        localDbs: [localDb],
      });

      await saveDbConfig(dbConfig);

      const localDbItems = getLocalDatabaseDbItems("db1", "my-list-1");
      expect(localDbItems.length).toEqual(1);

      await dbManager.renameLocalDb(localDbItems[0], "db2");

      const dbConfigFileContents = await readDbConfigDirectly();

      // Check that the db inside the list has been renamed
      const localListDbs =
        dbConfigFileContents.databases.local.lists[0].databases;
      expect(localListDbs.length).toBe(1);
      expect(localListDbs[0].name).toEqual("db2");

      // Check that the db outside of the list has not been renamed
      const localDbs = dbConfigFileContents.databases.local.databases;
      expect(localDbs.length).toBe(1);
      expect(localDbs[0]).toEqual(localDb);
    });
  });

  describe("removing items", () => {
    const remoteRepo1 = "owner1/repo1";
    const remoteRepo2 = "owner1/repo2";
    const remoteList = {
      name: "my-list-1",
      repositories: [remoteRepo1, remoteRepo2],
    };
    const remoteOwner = "owner1";
    const localDb = createLocalDbConfigItem({ name: "db1" });
    const localList = {
      name: "my-list-1",
      databases: [localDb],
    };
    const dbConfig = createDbConfig({
      remoteLists: [remoteList],
      remoteOwners: [remoteOwner],
      remoteRepos: [remoteRepo1, remoteRepo2],
      localLists: [localList],
      localDbs: [localDb],
      selected: {
        kind: SelectedDbItemKind.VariantAnalysisUserDefinedList,
        listName: remoteList.name,
      },
    });

    it("should remove remote user-defined list", async () => {
      await saveDbConfig(dbConfig);

      const remoteListDbItems = getRemoteUserDefinedListDbItems("my-list-1");
      expect(remoteListDbItems.length).toEqual(1);

      await dbManager.removeDbItem(remoteListDbItems[0]);

      const dbConfigFileContents = await readDbConfigDirectly();

      expect(dbConfigFileContents).toEqual({
        databases: {
          variantAnalysis: {
            repositoryLists: [],
            repositories: [remoteRepo1, remoteRepo2],
            owners: [remoteOwner],
          },
          local: {
            lists: [localList],
            databases: [localDb],
          },
        },
      });
    });

    it("should remove remote repo", async () => {
      await saveDbConfig(dbConfig);

      const remoteRepoDbItems = getRemoteRepoDbItems("owner1/repo1");
      expect(remoteRepoDbItems.length).toBe(1);

      await dbManager.removeDbItem(remoteRepoDbItems[0]);

      const dbConfigFileContents = await readDbConfigDirectly();

      expect(dbConfigFileContents).toEqual({
        databases: {
          variantAnalysis: {
            repositoryLists: [remoteList],
            repositories: [remoteRepo2],
            owners: [remoteOwner],
          },
          local: {
            lists: [localList],
            databases: [localDb],
          },
        },
        selected: {
          kind: SelectedDbItemKind.VariantAnalysisUserDefinedList,
          listName: remoteList.name,
        },
      });
    });

    it("should remove remote owner", async () => {
      await saveDbConfig(dbConfig);

      const remoteOwnerDbItems = getRemoteOwnerDbItems("owner1");
      expect(remoteOwnerDbItems.length).toEqual(1);

      await dbManager.removeDbItem(remoteOwnerDbItems[0]);

      const dbConfigFileContents = await readDbConfigDirectly();

      expect(dbConfigFileContents).toEqual({
        databases: {
          variantAnalysis: {
            repositoryLists: [remoteList],
            repositories: [remoteRepo1, remoteRepo2],
            owners: [],
          },
          local: {
            lists: [localList],
            databases: [localDb],
          },
        },
        selected: {
          kind: SelectedDbItemKind.VariantAnalysisUserDefinedList,
          listName: remoteList.name,
        },
      });
    });

    it("should remove local db list", async () => {
      await saveDbConfig(dbConfig);

      const localListDbItems = getLocalListDbItems("my-list-1");
      expect(localListDbItems.length).toEqual(1);

      await dbManager.removeDbItem(localListDbItems[0]);

      const dbConfigFileContents = await readDbConfigDirectly();

      expect(dbConfigFileContents).toEqual({
        databases: {
          variantAnalysis: {
            repositoryLists: [remoteList],
            repositories: [remoteRepo1, remoteRepo2],
            owners: [remoteOwner],
          },
          local: {
            lists: [],
            databases: [localDb],
          },
        },
        selected: {
          kind: SelectedDbItemKind.VariantAnalysisUserDefinedList,
          listName: remoteList.name,
        },
      });
    });

    it("should remove local database", async () => {
      await saveDbConfig(dbConfig);

      const localDbItems = getLocalDatabaseDbItems("db1");
      expect(localDbItems.length).toEqual(1);

      await dbManager.removeDbItem(localDbItems[0]);

      const dbConfigFileContents = await readDbConfigDirectly();

      expect(dbConfigFileContents).toEqual({
        databases: {
          variantAnalysis: {
            repositoryLists: [remoteList],
            repositories: [remoteRepo1, remoteRepo2],
            owners: [remoteOwner],
          },
          local: {
            lists: [localList],
            databases: [],
          },
        },
        selected: {
          kind: SelectedDbItemKind.VariantAnalysisUserDefinedList,
          listName: remoteList.name,
        },
      });
    });
  });

  describe("expanded behaviours", () => {
    it("should add item to expanded state", async () => {
      // Add item to config
      const listName = "my-list-1";
      const dbConfig = createDbConfig({
        remoteLists: [{ name: listName, repositories: [] }],
      });

      await saveDbConfig(dbConfig);

      // Add item to expanded state
      const dbItem = createRemoteUserDefinedListDbItem({
        listName,
      });

      await dbManager.addDbItemToExpandedState(dbItem);
      const expandedItems = app.workspaceState.get<ExpandedDbItem[]>(
        DbManager.DB_EXPANDED_STATE_KEY,
      );

      expect(expandedItems?.length).toEqual(1);
      const expandedItem =
        expandedItems![0] as RemoteUserDefinedListExpandedDbItem;
      expect(expandedItem.listName).toEqual(listName);
    });

    it("should remove item from expanded state", async () => {
      const listName = "my-list-2";
      const variantAnalysisList = {
        kind: ExpandedDbItemKind.RemoteUserDefinedList,
        listName,
      };

      // Add item to expanded state
      await app.workspaceState.update(DbManager.DB_EXPANDED_STATE_KEY, [
        variantAnalysisList,
      ]);

      // Remove item from expanded state
      const dbItem = createRemoteUserDefinedListDbItem({
        listName,
      });

      await dbManager.removeDbItemFromExpandedState(dbItem);
      const expandedItems = app.workspaceState.get<ExpandedDbItem[]>(
        DbManager.DB_EXPANDED_STATE_KEY,
      );

      expect(expandedItems?.length).toEqual(0);
    });

    it("should rename item in expanded state", async () => {
      // Add item to config
      const listName = "my-list-3";
      const dbConfig = createDbConfig({
        remoteLists: [{ name: listName, repositories: [] }],
      });
      await saveDbConfig(dbConfig);

      // Add item to expanded state
      const variantAnalysisList = {
        kind: ExpandedDbItemKind.RemoteUserDefinedList,
        listName,
      };

      await app.workspaceState.update(DbManager.DB_EXPANDED_STATE_KEY, [
        variantAnalysisList,
      ]);

      // Rename item
      const dbItem = createRemoteUserDefinedListDbItem({
        listName,
      });

      await dbManager.renameList(dbItem, "new-list-name");
      const expandedItems = app.workspaceState.get<ExpandedDbItem[]>(
        DbManager.DB_EXPANDED_STATE_KEY,
      );

      expect(expandedItems?.length).toEqual(1);
      const expandedItem =
        expandedItems![0] as RemoteUserDefinedListExpandedDbItem;
      expect(expandedItem.listName).toEqual("new-list-name");
    });

    it("should remove non existent items in expanded state when item is expanded", async () => {
      // We remove items from the expanded state if they are not in the config

      // Add item to config
      const listName = "my-list-4";
      const dbConfig = createDbConfig({
        remoteLists: [{ name: listName, repositories: [] }],
      });
      await saveDbConfig(dbConfig);

      // Populate expanded state with item
      const removedListName = "my-list-5";
      const removedVariantAnalysisList = {
        kind: ExpandedDbItemKind.RemoteUserDefinedList,
        listName: removedListName,
      };

      await app.workspaceState.update(DbManager.DB_EXPANDED_STATE_KEY, [
        removedVariantAnalysisList,
      ]);

      // Trigger adding an item that is not in the config
      const dbItem = createRemoteUserDefinedListDbItem({
        listName,
      });

      await dbManager.addDbItemToExpandedState(dbItem);
      const expandedItems = app.workspaceState.get<ExpandedDbItem[]>(
        DbManager.DB_EXPANDED_STATE_KEY,
      );

      expect(expandedItems?.length).toEqual(1);
      const expandedItem =
        expandedItems![0] as RemoteUserDefinedListExpandedDbItem;
      expect(expandedItem.listName).toEqual("my-list-4");
    });
  });

  async function saveDbConfig(dbConfig: DbConfig): Promise<void> {
    await writeJson(dbConfigFilePath, dbConfig);

    // Ideally we would just initialize the db config store at the start
    // of each test and then rely on the file watcher to update the config.
    // However, this requires adding sleep to the tests to allow for the
    // file watcher to catch up, so we instead initialize the config store here.
    await dbConfigStore.initialize();
  }

  async function readDbConfigDirectly(): Promise<DbConfig> {
    return (await readJSON(dbConfigFilePath)) as DbConfig;
  }

  function getLocalListDbItems(listName: string): LocalListDbItem[] {
    const dbItemsResult = dbManager.getDbItems();
    const dbItems = flattenDbItems(dbItemsResult.value);
    const listDbItems = dbItems
      .filter(isLocalListDbItem)
      .filter((i) => i.listName === listName);

    return listDbItems;
  }

  function getLocalDatabaseDbItems(
    dbName: string,
    parentListName?: string,
  ): LocalDatabaseDbItem[] {
    const dbItemsResult = dbManager.getDbItems();
    const dbItems = flattenDbItems(dbItemsResult.value);
    const localDbItems = dbItems
      .filter(isLocalDatabaseDbItem)
      .filter(
        (i) => i.databaseName === dbName && i.parentListName === parentListName,
      );

    return localDbItems;
  }

  function getRemoteRepoDbItems(
    repoName: string,
    parentListName?: string,
  ): RemoteRepoDbItem[] {
    const dbItemsResult = dbManager.getDbItems();
    const dbItems = flattenDbItems(dbItemsResult.value);
    const repoDbItems = dbItems
      .filter(isRemoteRepoDbItem)
      .filter(
        (i) =>
          i.repoFullName === repoName && i.parentListName === parentListName,
      );

    return repoDbItems;
  }

  function getRemoteOwnerDbItems(ownerName: string): RemoteOwnerDbItem[] {
    const dbItemsResult = dbManager.getDbItems();
    const dbItems = flattenDbItems(dbItemsResult.value);
    const ownerDbItems = dbItems
      .filter(isRemoteOwnerDbItem)
      .filter((i) => i.ownerName === ownerName);

    return ownerDbItems;
  }

  function getRemoteUserDefinedListDbItems(
    listName: string,
  ): RemoteUserDefinedListDbItem[] {
    const dbItemsResult = dbManager.getDbItems();
    const dbItems = flattenDbItems(dbItemsResult.value);
    const listDbItems = dbItems
      .filter(isRemoteUserDefinedListDbItem)
      .filter((i) => i.listName === listName);

    return listDbItems;
  }
});
