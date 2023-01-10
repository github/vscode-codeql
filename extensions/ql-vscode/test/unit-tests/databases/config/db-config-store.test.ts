import { ensureDir, remove, pathExists, writeJSON, readJSON } from "fs-extra";
import { join } from "path";
import { App } from "../../../../src/common/app";
import {
  DbConfig,
  SelectedDbItemKind,
} from "../../../../src/databases/config/db-config";
import { DbConfigStore } from "../../../../src/databases/config/db-config-store";
import {
  createDbConfig,
  createLocalDbConfigItem,
} from "../../../factories/db-config-factories";
import {
  createLocalDatabaseDbItem,
  createLocalListDbItem,
  createRemoteOwnerDbItem,
  createRemoteRepoDbItem,
  createRemoteUserDefinedListDbItem,
} from "../../../factories/db-item-factories";
import { createMockApp } from "../../../__mocks__/appMock";

describe("db config store", () => {
  const extensionPath = join(__dirname, "../../../..");
  const tempWorkspaceStoragePath = join(__dirname, "test-workspace");
  const testDataStoragePath = join(__dirname, "data");

  beforeEach(async () => {
    await ensureDir(tempWorkspaceStoragePath);
  });

  afterEach(async () => {
    await remove(tempWorkspaceStoragePath);
  });

  describe("initialize", () => {
    it("should create a new config if one does not exist", async () => {
      const app = createMockApp({
        extensionPath,
        workspaceStoragePath: tempWorkspaceStoragePath,
      });

      const configPath = join(
        tempWorkspaceStoragePath,
        "workspace-databases.json",
      );

      const configStore = new DbConfigStore(app, false);
      await configStore.initialize();

      expect(await pathExists(configPath)).toBe(true);

      const config = configStore.getConfig().value;
      expect(config.databases.remote.repositoryLists).toHaveLength(0);
      expect(config.databases.remote.owners).toHaveLength(0);
      expect(config.databases.remote.repositories).toHaveLength(0);
      expect(config.databases.local.lists).toHaveLength(0);
      expect(config.databases.local.databases).toHaveLength(0);
      expect(config.selected).toBeUndefined();

      configStore.dispose();
    });

    it("should load an existing config", async () => {
      const app = createMockApp({
        extensionPath,
        workspaceStoragePath: testDataStoragePath,
      });
      const configStore = new DbConfigStore(app, false);
      await configStore.initialize();

      const config = configStore.getConfig().value;
      expect(config.databases.remote.repositoryLists).toHaveLength(1);
      expect(config.databases.remote.repositoryLists[0]).toEqual({
        name: "repoList1",
        repositories: ["foo/bar", "foo/baz"],
      });
      expect(config.databases.remote.owners).toHaveLength(0);
      expect(config.databases.remote.repositories).toHaveLength(3);
      expect(config.databases.remote.repositories).toEqual([
        "owner/repo1",
        "owner/repo2",
        "owner/repo3",
      ]);
      expect(config.databases.local.lists).toHaveLength(2);
      expect(config.databases.local.lists[0]).toEqual({
        name: "localList1",
        databases: [
          {
            name: "foo/bar",
            dateAdded: 1668096745193,
            language: "go",
            storagePath: "/path/to/database/",
          },
        ],
      });
      expect(config.databases.local.databases).toHaveLength(1);
      expect(config.databases.local.databases[0]).toEqual({
        name: "example-db",
        dateAdded: 1668096927267,
        language: "ruby",
        storagePath: "/path/to/database/",
      });
      expect(config.selected).toEqual({
        kind: "remoteUserDefinedList",
        listName: "repoList1",
      });

      configStore.dispose();
    });

    it("should load an existing config without selected db", async () => {
      const testDataStoragePathWithout = join(
        __dirname,
        "data",
        "without-selected",
      );

      const app = createMockApp({
        extensionPath,
        workspaceStoragePath: testDataStoragePathWithout,
      });

      const configStore = new DbConfigStore(app, false);
      await configStore.initialize();

      const config = configStore.getConfig().value;
      expect(config.selected).toBeUndefined();

      configStore.dispose();
    });

    it("should not allow modification of the config", async () => {
      const app = createMockApp({
        extensionPath,
        workspaceStoragePath: testDataStoragePath,
      });
      const configStore = new DbConfigStore(app, false);
      await configStore.initialize();

      const config = configStore.getConfig().value;
      config.databases.remote.repositoryLists = [];

      const reRetrievedConfig = configStore.getConfig().value;
      expect(reRetrievedConfig.databases.remote.repositoryLists).toHaveLength(
        1,
      );

      configStore.dispose();
    });

    it("should set codeQLVariantAnalysisRepositories.configError to true when config has error", async () => {
      const testDataStoragePathInvalid = join(__dirname, "data", "invalid");

      const app = createMockApp({
        extensionPath,
        workspaceStoragePath: testDataStoragePathInvalid,
      });
      const configStore = new DbConfigStore(app, false);
      await configStore.initialize();

      expect(app.executeCommand).toBeCalledWith(
        "setContext",
        "codeQLVariantAnalysisRepositories.configError",
        true,
      );
      configStore.dispose();
    });

    it("should set codeQLVariantAnalysisRepositories.configError to false when config is valid", async () => {
      const app = createMockApp({
        extensionPath,
        workspaceStoragePath: testDataStoragePath,
      });
      const configStore = new DbConfigStore(app, false);
      await configStore.initialize();

      expect(app.executeCommand).toBeCalledWith(
        "setContext",
        "codeQLVariantAnalysisRepositories.configError",
        false,
      );

      configStore.dispose();
    });
  });

  describe("add db items", () => {
    let app: App;
    let configPath: string;

    beforeEach(async () => {
      app = createMockApp({
        extensionPath,
        workspaceStoragePath: tempWorkspaceStoragePath,
      });

      configPath = join(tempWorkspaceStoragePath, "workspace-databases.json");
    });

    it("should add a remote repository", async () => {
      // Initial set up
      const dbConfig = createDbConfig();

      await writeJSON(configPath, dbConfig);

      const configStore = new DbConfigStore(app);
      await configStore.initialize();

      // Add
      await configStore.addRemoteRepo("repo1");

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedRemoteDbs = updatedDbConfig.databases.remote;
      expect(updatedRemoteDbs.repositories).toHaveLength(1);
      expect(updatedRemoteDbs.repositories).toEqual(["repo1"]);

      configStore.dispose();
    });

    it("should add a remote repository to the correct list", async () => {
      // Initial set up
      const dbConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: [],
          },
        ],
      });

      await writeJSON(configPath, dbConfig);

      const configStore = new DbConfigStore(app);
      await configStore.initialize();

      // Add
      await configStore.addRemoteRepo("repo1", "list1");

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedRemoteDbs = updatedDbConfig.databases.remote;
      expect(updatedRemoteDbs.repositories).toHaveLength(0);
      expect(updatedRemoteDbs.repositoryLists).toHaveLength(1);
      expect(updatedRemoteDbs.repositoryLists[0]).toEqual({
        name: "list1",
        repositories: ["repo1"],
      });

      configStore.dispose();
    });

    it("should add a remote owner", async () => {
      // Initial set up
      const dbConfig = createDbConfig();

      await writeJSON(configPath, dbConfig);

      const configStore = new DbConfigStore(app);
      await configStore.initialize();

      // Add
      await configStore.addRemoteOwner("owner1");

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedRemoteDbs = updatedDbConfig.databases.remote;
      expect(updatedRemoteDbs.owners).toHaveLength(1);
      expect(updatedRemoteDbs.owners).toEqual(["owner1"]);

      configStore.dispose();
    });

    it("should add a local list", async () => {
      // Initial set up
      const dbConfig = createDbConfig();

      await writeJSON(configPath, dbConfig);

      const configStore = new DbConfigStore(app);
      await configStore.initialize();

      // Add
      await configStore.addLocalList("list1");

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedLocalDbs = updatedDbConfig.databases.local;
      expect(updatedLocalDbs.lists).toHaveLength(1);
      expect(updatedLocalDbs.lists[0].name).toEqual("list1");

      configStore.dispose();
    });

    it("should add a remote list", async () => {
      // Initial set up
      const dbConfig = createDbConfig();

      await writeJSON(configPath, dbConfig);

      const configStore = new DbConfigStore(app);
      await configStore.initialize();

      // Add
      await configStore.addRemoteList("list1");

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedRemoteDbs = updatedDbConfig.databases.remote;
      expect(updatedRemoteDbs.repositoryLists).toHaveLength(1);
      expect(updatedRemoteDbs.repositoryLists[0].name).toEqual("list1");

      configStore.dispose();
    });
  });

  describe("db and list renaming", () => {
    let app: App;
    let configPath: string;

    beforeEach(async () => {
      app = createMockApp({
        extensionPath,
        workspaceStoragePath: tempWorkspaceStoragePath,
      });

      configPath = join(tempWorkspaceStoragePath, "workspace-databases.json");
    });

    it("should allow renaming a remote list", async () => {
      // Initial set up
      const dbConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: ["owner/repo1", "owner/repo2"],
          },
        ],
        selected: {
          kind: SelectedDbItemKind.RemoteRepository,
          repositoryName: "owner/repo2",
          listName: "list1",
        },
      });

      await writeJSON(configPath, dbConfig);

      const configStore = new DbConfigStore(app, false);
      await configStore.initialize();

      // Rename
      const currentDbItem = createRemoteUserDefinedListDbItem({
        listName: "list1",
      });
      await configStore.renameRemoteList(currentDbItem, "listRenamed");

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedRemoteDbs = updatedDbConfig.databases.remote;
      expect(updatedRemoteDbs.repositoryLists).toHaveLength(1);
      expect(updatedRemoteDbs.repositoryLists[0].name).toEqual("listRenamed");

      expect(updatedDbConfig.selected).toEqual({
        kind: SelectedDbItemKind.RemoteRepository,
        repositoryName: "owner/repo2",
        listName: "listRenamed",
      });

      configStore.dispose();
    });

    it("should allow renaming a local list", async () => {
      // Initial set up
      const dbConfig = createDbConfig({
        localLists: [
          {
            name: "list1",
            databases: [
              createLocalDbConfigItem(),
              createLocalDbConfigItem(),
              createLocalDbConfigItem(),
            ],
          },
        ],
        selected: {
          kind: SelectedDbItemKind.LocalUserDefinedList,
          listName: "list1",
        },
      });

      await writeJSON(configPath, dbConfig);

      const configStore = new DbConfigStore(app, false);
      await configStore.initialize();

      // Rename
      const currentDbItem = createLocalListDbItem({
        listName: "list1",
      });
      await configStore.renameLocalList(currentDbItem, "listRenamed");

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedLocalDbs = updatedDbConfig.databases.local;
      expect(updatedLocalDbs.lists).toHaveLength(1);
      expect(updatedLocalDbs.lists[0].name).toEqual("listRenamed");

      expect(updatedDbConfig.selected).toEqual({
        kind: SelectedDbItemKind.LocalUserDefinedList,
        listName: "listRenamed",
      });

      configStore.dispose();
    });

    it("should allow renaming of a local db", async () => {
      // Initial set up
      const dbConfig = createDbConfig({
        localLists: [
          {
            name: "list1",
            databases: [
              createLocalDbConfigItem({ name: "db1" }),
              createLocalDbConfigItem({ name: "db2" }),
              createLocalDbConfigItem({ name: "db3" }),
            ],
          },
        ],
        selected: {
          kind: SelectedDbItemKind.LocalDatabase,
          databaseName: "db1",
          listName: "list1",
        },
      });

      await writeJSON(configPath, dbConfig);

      const configStore = new DbConfigStore(app, false);
      await configStore.initialize();

      // Rename
      const currentDbItem = createLocalDatabaseDbItem({
        databaseName: "db1",
      });
      await configStore.renameLocalDb(currentDbItem, "dbRenamed", "list1");

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedLocalDbs = updatedDbConfig.databases.local;
      expect(updatedLocalDbs.lists).toHaveLength(1);
      expect(updatedLocalDbs.lists[0].name).toEqual("list1");
      expect(updatedLocalDbs.lists[0].databases.length).toEqual(3);
      expect(updatedLocalDbs.lists[0].databases[0].name).toEqual("dbRenamed");
      expect(updatedDbConfig.selected).toEqual({
        kind: SelectedDbItemKind.LocalDatabase,
        databaseName: "dbRenamed",
        listName: "list1",
      });

      configStore.dispose();
    });

    it("should throw if the name of a list is taken", async () => {
      // Initial set up
      const dbConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: ["owner/repo1", "owner/repo2"],
          },
          {
            name: "list2",
            repositories: ["owner/repo1", "owner/repo2"],
          },
        ],
      });

      await writeJSON(configPath, dbConfig);

      const configStore = new DbConfigStore(app, false);
      await configStore.initialize();

      // Rename
      const currentDbItem = createRemoteUserDefinedListDbItem({
        listName: "list1",
      });
      await expect(
        configStore.renameRemoteList(currentDbItem, "list2"),
      ).rejects.toThrow(`A remote list with the name 'list2' already exists`);

      configStore.dispose();
    });
  });

  describe("db and list deletion", () => {
    let app: App;
    let configPath: string;

    beforeEach(async () => {
      app = createMockApp({
        extensionPath,
        workspaceStoragePath: tempWorkspaceStoragePath,
      });

      configPath = join(tempWorkspaceStoragePath, "workspace-databases.json");
    });

    it("should remove a single db item", async () => {
      // Initial set up
      const dbConfig = createDbConfig({
        remoteOwners: ["owner1", "owner2"],
        selected: {
          kind: SelectedDbItemKind.RemoteOwner,
          ownerName: "owner1",
        },
      });

      await writeJSON(configPath, dbConfig);

      const configStore = new DbConfigStore(app, false);
      await configStore.initialize();

      // Remove
      const currentDbItem = createRemoteOwnerDbItem({
        ownerName: "owner1",
      });
      await configStore.removeDbItem(currentDbItem);

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedRemoteDbs = updatedDbConfig.databases.remote;
      expect(updatedRemoteDbs.owners).toHaveLength(1);
      expect(updatedRemoteDbs.owners[0]).toEqual("owner2");

      expect(updatedDbConfig.selected).toEqual(undefined);

      configStore.dispose();
    });

    it("should remove a list db item", async () => {
      // Initial set up
      const dbConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: ["owner/repo1", "owner/repo2"],
          },
        ],
        selected: {
          kind: SelectedDbItemKind.RemoteUserDefinedList,
          listName: "list1",
        },
      });

      await writeJSON(configPath, dbConfig);

      const configStore = new DbConfigStore(app, false);
      await configStore.initialize();

      // Remove
      const currentDbItem = createRemoteUserDefinedListDbItem({
        listName: "list1",
      });
      await configStore.removeDbItem(currentDbItem);

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedRemoteDbs = updatedDbConfig.databases.remote;
      expect(updatedRemoteDbs.repositoryLists).toHaveLength(0);

      expect(updatedDbConfig.selected).toEqual(undefined);

      configStore.dispose();
    });

    it("should remove a db item in a list", async () => {
      // Initial set up
      const dbConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: ["owner/repo1", "owner/repo2"],
          },
        ],
        selected: {
          kind: SelectedDbItemKind.RemoteRepository,
          repositoryName: "owner/repo1",
          listName: "list1",
        },
      });

      await writeJSON(configPath, dbConfig);

      const configStore = new DbConfigStore(app, false);
      await configStore.initialize();

      // Remove
      const currentDbItem = createRemoteRepoDbItem({
        repoFullName: "owner/repo1",
        parentListName: "list1",
      });
      await configStore.removeDbItem(currentDbItem);

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedRemoteDbs = updatedDbConfig.databases.remote;
      expect(updatedRemoteDbs.repositoryLists[0].repositories).toHaveLength(1);
      expect(updatedRemoteDbs.repositoryLists[0].repositories[0]).toEqual(
        "owner/repo2",
      );

      expect(updatedDbConfig.selected).toEqual(undefined);

      configStore.dispose();
    });
  });
});
