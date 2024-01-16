import { ensureDir, remove, pathExists, writeJSON, readJSON } from "fs-extra";
import { join } from "path";
import type { App } from "../../../../src/common/app";
import type {
  DbConfig,
  SelectedDbItem,
} from "../../../../src/databases/config/db-config";
import { SelectedDbItemKind } from "../../../../src/databases/config/db-config";
import { DbConfigStore } from "../../../../src/databases/config/db-config-store";
import { createDbConfig } from "../../../factories/db-config-factories";
import {
  createRemoteOwnerDbItem,
  createRemoteRepoDbItem,
  createRemoteUserDefinedListDbItem,
} from "../../../factories/db-item-factories";
import { createMockApp } from "../../../__mocks__/appMock";
import { createMockCommandManager } from "../../../__mocks__/commandsMock";

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
        DbConfigStore.databaseConfigFileName,
      );

      const configStore = new DbConfigStore(app, false);
      await configStore.initialize();

      expect(await pathExists(configPath)).toBe(true);

      const config = configStore.getConfig().value;
      expect(config.databases.variantAnalysis.repositoryLists).toHaveLength(0);
      expect(config.databases.variantAnalysis.owners).toHaveLength(0);
      expect(config.databases.variantAnalysis.repositories).toHaveLength(0);
      expect(config.selected).toEqual({
        kind: SelectedDbItemKind.VariantAnalysisSystemDefinedList,
        listName: "top_10",
      });

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
      expect(config.databases.variantAnalysis.repositoryLists).toHaveLength(1);
      expect(config.databases.variantAnalysis.repositoryLists[0]).toEqual({
        name: "repoList1",
        repositories: ["foo/bar", "foo/baz"],
      });
      expect(config.databases.variantAnalysis.owners).toHaveLength(0);
      expect(config.databases.variantAnalysis.repositories).toHaveLength(3);
      expect(config.databases.variantAnalysis.repositories).toEqual([
        "owner/repo1",
        "owner/repo2",
        "owner/repo3",
      ]);
      expect(config.selected).toEqual({
        kind: SelectedDbItemKind.VariantAnalysisUserDefinedList,
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
      config.databases.variantAnalysis.repositoryLists = [];

      const reRetrievedConfig = configStore.getConfig().value;
      expect(
        reRetrievedConfig.databases.variantAnalysis.repositoryLists,
      ).toHaveLength(1);

      configStore.dispose();
    });

    it("should set codeQLVariantAnalysisRepositories.configError to true when config has error", async () => {
      const testDataStoragePathInvalid = join(__dirname, "data", "invalid");

      const executeCommand = jest.fn();
      const app = createMockApp({
        extensionPath,
        workspaceStoragePath: testDataStoragePathInvalid,
        commands: createMockCommandManager({ executeCommand }),
      });
      const configStore = new DbConfigStore(app, false);
      await configStore.initialize();

      expect(executeCommand).toHaveBeenCalledWith(
        "setContext",
        "codeQLVariantAnalysisRepositories.configError",
        true,
      );
      configStore.dispose();
    });

    it("should set codeQLVariantAnalysisRepositories.configError to false when config is valid", async () => {
      const executeCommand = jest.fn();
      const app = createMockApp({
        extensionPath,
        workspaceStoragePath: testDataStoragePath,
        commands: createMockCommandManager({ executeCommand }),
      });
      const configStore = new DbConfigStore(app, false);
      await configStore.initialize();

      expect(executeCommand).toHaveBeenCalledWith(
        "setContext",
        "codeQLVariantAnalysisRepositories.configError",
        false,
      );

      configStore.dispose();
    });
  });

  describe("db and list addition", () => {
    let app: App;
    let configPath: string;

    beforeEach(async () => {
      app = createMockApp({
        extensionPath,
        workspaceStoragePath: tempWorkspaceStoragePath,
      });

      configPath = join(
        tempWorkspaceStoragePath,
        DbConfigStore.databaseConfigFileName,
      );
    });

    it("should add a remote repository", async () => {
      // Initial set up
      const dbConfig = createDbConfig();

      const configStore = await initializeConfig(dbConfig, configPath, app);

      // Add
      await configStore.addRemoteRepo("repo1");

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedRemoteDbs = updatedDbConfig.databases.variantAnalysis;
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

      const configStore = await initializeConfig(dbConfig, configPath, app);

      // Add
      await configStore.addRemoteRepo("repo1", "list1");

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedRemoteDbs = updatedDbConfig.databases.variantAnalysis;
      expect(updatedRemoteDbs.repositories).toHaveLength(0);
      expect(updatedRemoteDbs.repositoryLists).toHaveLength(1);
      expect(updatedRemoteDbs.repositoryLists[0]).toEqual({
        name: "list1",
        repositories: ["repo1"],
      });

      configStore.dispose();
    });

    it("should add unique remote repositories to the correct list", async () => {
      // Initial set up
      const dbConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: ["owner/repo1"],
          },
        ],
      });

      const configStore = await initializeConfig(dbConfig, configPath, app);
      expect(
        configStore.getConfig().value.databases.variantAnalysis
          .repositoryLists[0],
      ).toEqual({
        name: "list1",
        repositories: ["owner/repo1"],
      });

      // Add
      await configStore.addRemoteReposToList(
        ["owner/repo1", "owner/repo2"],
        "list1",
      );

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedRemoteDbs = updatedDbConfig.databases.variantAnalysis;
      expect(updatedRemoteDbs.repositories).toHaveLength(0);
      expect(updatedRemoteDbs.repositoryLists).toHaveLength(1);
      expect(updatedRemoteDbs.repositoryLists[0]).toEqual({
        name: "list1",
        repositories: ["owner/repo1", "owner/repo2"],
      });

      configStore.dispose();
    });

    it("should add a remote owner", async () => {
      // Initial set up
      const dbConfig = createDbConfig();

      const configStore = await initializeConfig(dbConfig, configPath, app);

      // Add
      await configStore.addRemoteOwner("owner1");

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedRemoteDbs = updatedDbConfig.databases.variantAnalysis;
      expect(updatedRemoteDbs.owners).toHaveLength(1);
      expect(updatedRemoteDbs.owners).toEqual(["owner1"]);

      configStore.dispose();
    });

    it("should add a remote list", async () => {
      // Initial set up
      const dbConfig = createDbConfig();

      const configStore = await initializeConfig(dbConfig, configPath, app);

      // Add
      await configStore.addRemoteList("list1");

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedRemoteDbs = updatedDbConfig.databases.variantAnalysis;
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

      configPath = join(
        tempWorkspaceStoragePath,
        DbConfigStore.databaseConfigFileName,
      );
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
          kind: SelectedDbItemKind.VariantAnalysisRepository,
          repositoryName: "owner/repo2",
          listName: "list1",
        },
      });

      const configStore = await initializeConfig(dbConfig, configPath, app);

      // Rename
      const currentDbItem = createRemoteUserDefinedListDbItem({
        listName: "list1",
      });
      await configStore.renameRemoteList(currentDbItem, "listRenamed");

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedRemoteDbs = updatedDbConfig.databases.variantAnalysis;
      expect(updatedRemoteDbs.repositoryLists).toHaveLength(1);
      expect(updatedRemoteDbs.repositoryLists[0].name).toEqual("listRenamed");

      expect(updatedDbConfig.selected).toEqual({
        kind: SelectedDbItemKind.VariantAnalysisRepository,
        repositoryName: "owner/repo2",
        listName: "listRenamed",
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

      const configStore = await initializeConfig(dbConfig, configPath, app);

      // Rename
      const currentDbItem = createRemoteUserDefinedListDbItem({
        listName: "list1",
      });
      await expect(
        configStore.renameRemoteList(currentDbItem, "list2"),
      ).rejects.toThrow(
        `A variant analysis list with the name 'list2' already exists`,
      );

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

      configPath = join(
        tempWorkspaceStoragePath,
        DbConfigStore.databaseConfigFileName,
      );
    });

    it("should remove a single db item", async () => {
      // Initial set up
      const dbConfig = createDbConfig({
        remoteOwners: ["owner1", "owner2"],
        selected: {
          kind: SelectedDbItemKind.VariantAnalysisOwner,
          ownerName: "owner1",
        },
      });

      const configStore = await initializeConfig(dbConfig, configPath, app);

      // Remove
      const currentDbItem = createRemoteOwnerDbItem({
        ownerName: "owner1",
      });
      await configStore.removeDbItem(currentDbItem);

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedRemoteDbs = updatedDbConfig.databases.variantAnalysis;
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
          kind: SelectedDbItemKind.VariantAnalysisUserDefinedList,
          listName: "list1",
        },
      });

      const configStore = await initializeConfig(dbConfig, configPath, app);

      // Remove
      const currentDbItem = createRemoteUserDefinedListDbItem({
        listName: "list1",
      });
      await configStore.removeDbItem(currentDbItem);

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedRemoteDbs = updatedDbConfig.databases.variantAnalysis;
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
          kind: SelectedDbItemKind.VariantAnalysisRepository,
          repositoryName: "owner/repo1",
          listName: "list1",
        },
      });

      const configStore = await initializeConfig(dbConfig, configPath, app);

      // Remove
      const currentDbItem = createRemoteRepoDbItem({
        repoFullName: "owner/repo1",
        parentListName: "list1",
      });
      await configStore.removeDbItem(currentDbItem);

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      const updatedRemoteDbs = updatedDbConfig.databases.variantAnalysis;
      expect(updatedRemoteDbs.repositoryLists[0].repositories).toHaveLength(1);
      expect(updatedRemoteDbs.repositoryLists[0].repositories[0]).toEqual(
        "owner/repo2",
      );

      expect(updatedDbConfig.selected).toEqual(undefined);

      configStore.dispose();
    });
  });

  describe("set selected item", () => {
    let app: App;
    let configPath: string;

    beforeEach(async () => {
      app = createMockApp({
        extensionPath,
        workspaceStoragePath: tempWorkspaceStoragePath,
      });

      configPath = join(
        tempWorkspaceStoragePath,
        DbConfigStore.databaseConfigFileName,
      );
    });

    it("should set the selected item", async () => {
      // Initial set up
      const configStore = new DbConfigStore(app, false);
      await configStore.initialize();

      // Set selected
      const selectedItem: SelectedDbItem = {
        kind: SelectedDbItemKind.VariantAnalysisOwner,
        ownerName: "owner2",
      };

      await configStore.setSelectedDbItem(selectedItem);

      // Read the config file
      const updatedDbConfig = (await readJSON(configPath)) as DbConfig;

      // Check that the config file has been updated
      expect(updatedDbConfig.selected).toEqual(selectedItem);

      configStore.dispose();
    });
  });

  describe("existence checks", () => {
    let app: App;
    let configPath: string;

    beforeEach(async () => {
      app = createMockApp({
        extensionPath,
        workspaceStoragePath: tempWorkspaceStoragePath,
      });

      configPath = join(
        tempWorkspaceStoragePath,
        DbConfigStore.databaseConfigFileName,
      );
    });

    it("should return true if a remote owner exists", async () => {
      // Initial set up
      const dbConfig = createDbConfig({
        remoteOwners: ["owner1", "owner2"],
      });

      const configStore = await initializeConfig(dbConfig, configPath, app);

      // Check
      const doesExist = configStore.doesRemoteOwnerExist("owner1");
      expect(doesExist).toEqual(true);

      configStore.dispose();
    });

    it("should return true if a remote list exists", async () => {
      // Initial set up
      const dbConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: ["owner/repo1", "owner/repo2"],
          },
        ],
      });

      const configStore = await initializeConfig(dbConfig, configPath, app);

      // Check
      const doesExist = configStore.doesRemoteListExist("list1");
      expect(doesExist).toEqual(true);

      configStore.dispose();
    });

    it("should return true if a remote db exists", async () => {
      // Initial set up
      const dbConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: ["owner/repo1", "owner/repo2"],
          },
        ],
      });

      const configStore = await initializeConfig(dbConfig, configPath, app);

      // Check
      const doesExist = configStore.doesRemoteDbExist("owner/repo1", "list1");
      expect(doesExist).toEqual(true);

      configStore.dispose();
    });

    it("should return false if items do not exist", async () => {
      // Initial set up
      const dbConfig = createDbConfig({});

      const configStore = await initializeConfig(dbConfig, configPath, app);

      // Check
      const doesRemoteDbExist = configStore.doesRemoteDbExist("db1", "list1");
      expect(doesRemoteDbExist).toEqual(false);
      const doesRemoteListExist = configStore.doesRemoteListExist("list1");
      expect(doesRemoteListExist).toEqual(false);
      const doesRemoteOwnerExist = configStore.doesRemoteOwnerExist("owner1");
      expect(doesRemoteOwnerExist).toEqual(false);

      configStore.dispose();
    });
  });

  async function initializeConfig(
    dbConfig: DbConfig,
    configPath: string,
    app: App,
  ): Promise<DbConfigStore> {
    await writeJSON(configPath, dbConfig);
    const configStore = new DbConfigStore(app, false);
    await configStore.initialize();

    return configStore;
  }
});
