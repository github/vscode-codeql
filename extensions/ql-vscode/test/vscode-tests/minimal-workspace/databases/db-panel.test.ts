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
import { DbItemKind, DbListKind } from "../../../../src/databases/db-item";
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
        new Error(
          "A variant analysis list with the name 'my-list-1' already exists",
        ),
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
          "A variant analysis repository with the name 'owner1/repo1' already exists",
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
        new Error("An owner with the name 'owner1' already exists"),
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
