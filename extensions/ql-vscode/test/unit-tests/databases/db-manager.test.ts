import { ensureDir, readJSON, remove, writeJson } from "fs-extra";
import { join } from "path";
import { DbConfig } from "../../../src/databases/config/db-config";
import { DbConfigStore } from "../../../src/databases/config/db-config-store";
import {
  flattenDbItems,
  isLocalListDbItem,
  isRemoteUserDefinedListDbItem,
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
  const extensionPath = join(__dirname, "../../..");
  const tempWorkspaceStoragePath = join(__dirname, "test-workspace");
  const app = createMockApp({
    extensionPath,
    workspaceStoragePath: tempWorkspaceStoragePath,
  });
  const dbConfigStore = new DbConfigStore(app);
  const dbManager = new DbManager(app, dbConfigStore);

  beforeEach(async () => {
    await ensureDir(tempWorkspaceStoragePath);
  });

  afterEach(async () => {
    await remove(tempWorkspaceStoragePath);
  });

  const dbConfigFilePath = join(
    tempWorkspaceStoragePath,
    "workspace-databases.json",
  );

  describe("renaming items", () => {
    it("should rename remote db list", async () => {
      const dbConfig = createDbConfig({
        remoteLists: [
          {
            name: "my-list-1",
            repositories: ["owner1/repo1", "owner1/repo2"],
          },
        ],
      });

      await saveDbConfig(dbConfig);

      const dbItem = getRemoteUserDefinedListDbItem("my-list-1");

      await dbManager.renameList(dbItem, "my-list-2");

      const dbConfigFileContents = await readDbConfigDirectly();
      const remoteLists = dbConfigFileContents.databases.remote.repositoryLists;
      expect(remoteLists.length).toBe(1);
      expect(remoteLists[0]).toEqual({
        name: "my-list-2",
        repositories: ["owner1/repo1", "owner1/repo2"],
      });

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

    it("should rename local db list", async () => {
      const localDb = createLocalDbConfigItem();
      const dbConfig = createDbConfig({
        localLists: [
          {
            name: "my-list-1",
            databases: [localDb],
          },
        ],
      });

      await saveDbConfig(dbConfig);

      const dbItem = getLocalListDbItem("my-list-1");

      await dbManager.renameList(dbItem, "my-list-2");

      const dbConfigFileContents = await readDbConfigDirectly();
      const localLists = dbConfigFileContents.databases.local.lists;
      expect(localLists.length).toBe(1);
      expect(localLists[0]).toEqual({
        name: "my-list-2",
        databases: [localDb],
      });

      function getLocalListDbItem(listName: string): LocalListDbItem {
        const dbItemsResult = dbManager.getDbItems();
        const dbItems = flattenDbItems(dbItemsResult.value);
        const listDbItems = dbItems
          .filter(isLocalListDbItem)
          .filter((i) => i.listName === listName);

        expect(listDbItems.length).toEqual(1);
        return listDbItems[0];
      }
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
});
