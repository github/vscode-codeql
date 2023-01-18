import { join } from "path";
import { ensureDir, readJSON, remove, writeJson } from "fs-extra";
import {
  DbConfig,
  SelectedDbItemKind,
} from "../../../../src/databases/config/db-config";
import { DbManager } from "../../../../src/databases/db-manager";
import { DbConfigStore } from "../../../../src/databases/config/db-config-store";
import { DbTreeDataProvider } from "../../../../src/databases/ui/db-tree-data-provider";
import { DbItemKind, DbListKind } from "../../../../src/databases/db-item";
import { ExtensionApp } from "../../../../src/common/vscode/vscode-app";
import { createMockExtensionContext } from "../../../factories/extension-context";
import { createDbConfig } from "../../../factories/db-config-factories";

describe("db panel add items", () => {
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

  async function saveDbConfig(dbConfig: DbConfig): Promise<void> {
    await writeJson(dbConfigFilePath, dbConfig);

    // Ideally we would just initialise the db config store at the start
    // of each test and then rely on the file watcher to update the config.
    // However, this requires adding sleep to the tests to allow for the
    // file watcher to catch up, so we instead initialise the config store here.
    await dbConfigStore.initialize();
    dbTreeDataProvider = new DbTreeDataProvider(dbManager);
  }

  async function readDbConfigDirectly(): Promise<DbConfig> {
    // Read the workspace databases JSON file directly to check that the new list has been added.
    // We can't use the dbConfigStore's `read` function here because it depends on the file watcher
    // picking up changes, and we don't control the timing of that.
    return (await readJSON(dbConfigFilePath)) as DbConfig;
  }
});
