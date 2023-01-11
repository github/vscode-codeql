import { ensureDir, readJSON, remove, writeJson } from "fs-extra";
import { join } from "path";
import { DbConfig } from "../../../src/databases/config/db-config";
import { DbConfigStore } from "../../../src/databases/config/db-config-store";
import {
  flattenDbItems,
  isLocalDatabaseDbItem,
  isLocalListDbItem,
  isRemoteUserDefinedListDbItem,
  LocalDatabaseDbItem,
  LocalListDbItem,
  RemoteUserDefinedListDbItem,
} from "../../../src/databases/db-item";
import { DbManager } from "../../../src/databases/db-manager";
import {
  createDbConfig,
  createLocalDbConfigItem,
} from "../../factories/db-config-factories";
import { createMockApp } from "../../__mocks__/appMock";

// Note: Although these are "unit tests" (i.e. not integrating with VS Code), they do
// test the interaction/"integration" between the DbManager and the DbConfigStore.
describe("db manager", () => {
  let dbManager: DbManager;
  let dbConfigStore: DbConfigStore;
  let tempWorkspaceStoragePath: string;
  let dbConfigFilePath: string;

  beforeEach(async () => {
    tempWorkspaceStoragePath = join(__dirname, "test-workspace-db-manager");

    const extensionPath = join(__dirname, "../../..");
    const app = createMockApp({
      extensionPath,
      workspaceStoragePath: tempWorkspaceStoragePath,
    });

    dbConfigStore = new DbConfigStore(app);
    dbManager = new DbManager(app, dbConfigStore);
    await ensureDir(tempWorkspaceStoragePath);

    dbConfigFilePath = join(
      tempWorkspaceStoragePath,
      "workspace-databases.json",
    );
  });

  afterEach(async () => {
    await remove(tempWorkspaceStoragePath);
    dbConfigStore.dispose();
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

    it("should rename remote db list", async () => {
      const dbConfig = createDbConfig({
        remoteLists: [remoteList],
        localLists: [localList],
      });

      await saveDbConfig(dbConfig);

      const dbItem = getRemoteUserDefinedListDbItem("my-list-1");

      await dbManager.renameList(dbItem, "my-list-2");

      const dbConfigFileContents = await readDbConfigDirectly();

      // Check that the remote list has been renamed
      const remoteLists = dbConfigFileContents.databases.remote.repositoryLists;
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

      const dbItem = getLocalListDbItem("my-list-1");

      await dbManager.renameList(dbItem, "my-list-2");

      const dbConfigFileContents = await readDbConfigDirectly();

      // Check that the local list has been renamed
      const localLists = dbConfigFileContents.databases.local.lists;
      expect(localLists.length).toBe(1);
      expect(localLists[0]).toEqual({
        name: "my-list-2",
        databases: [localDb],
      });

      // Check that the remote list has not been renamed
      const remoteLists = dbConfigFileContents.databases.remote.repositoryLists;
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

      const dbItem = getLocalDatabaseDbItem("db1");

      await dbManager.renameLocalDb(dbItem, "db2");

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

      const dbItem = getLocalDatabaseDbItem("db1", "my-list-1");

      await dbManager.renameLocalDb(dbItem, "db2");

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

  function getLocalListDbItem(listName: string): LocalListDbItem {
    const dbItemsResult = dbManager.getDbItems();
    const dbItems = flattenDbItems(dbItemsResult.value);
    const listDbItems = dbItems
      .filter(isLocalListDbItem)
      .filter((i) => i.listName === listName);

    expect(listDbItems.length).toEqual(1);
    return listDbItems[0];
  }

  function getLocalDatabaseDbItem(
    dbName: string,
    parentListName?: string,
  ): LocalDatabaseDbItem {
    const dbItemsResult = dbManager.getDbItems();
    const dbItems = flattenDbItems(dbItemsResult.value);
    const localDbItems = dbItems
      .filter(isLocalDatabaseDbItem)
      .filter(
        (i) => i.databaseName === dbName && i.parentListName === parentListName,
      );

    expect(localDbItems.length).toEqual(1);
    return localDbItems[0];
  }

  function getRemoteUserDefinedListDbItem(
    listName: string,
  ): RemoteUserDefinedListDbItem {
    const dbItemsResult = dbManager.getDbItems();
    const dbItems = flattenDbItems(dbItemsResult.value);
    const listDbItems = dbItems
      .filter(isRemoteUserDefinedListDbItem)
      .filter((i) => i.listName === listName);

    expect(listDbItems.length).toEqual(1);
    return listDbItems[0];
  }
});
