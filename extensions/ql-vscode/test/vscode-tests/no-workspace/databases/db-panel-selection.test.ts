import { join } from "path";
import { ensureDir, remove, writeJson } from "fs-extra";
import type { DbConfig } from "../../../../src/databases/config/db-config";
import { SelectedDbItemKind } from "../../../../src/databases/config/db-config";
import { DbManager } from "../../../../src/databases/db-manager";
import { DbConfigStore } from "../../../../src/databases/config/db-config-store";
import { DbTreeDataProvider } from "../../../../src/databases/ui/db-tree-data-provider";
import { DbItemKind } from "../../../../src/databases/db-item";
import type { DbTreeViewItem } from "../../../../src/databases/ui/db-tree-view-item";
import { SELECTED_DB_ITEM_RESOURCE_URI } from "../../../../src/databases/ui/db-tree-view-item";
import { ExtensionApp } from "../../../../src/common/vscode/extension-app";
import { createMockExtensionContext } from "../../../factories/extension-context";
import { createDbConfig } from "../../../factories/db-config-factories";
import { setRemoteControllerRepo } from "../../../../src/config";
import { createMockVariantAnalysisConfig } from "../../../factories/config";

describe("db panel selection", () => {
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
    dbManager = new DbManager(
      app,
      dbConfigStore,
      createMockVariantAnalysisConfig(),
    );
  });

  beforeEach(async () => {
    await ensureDir(workspaceStoragePath);

    await setRemoteControllerRepo("github/codeql");
  });

  afterEach(async () => {
    await remove(workspaceStoragePath);
  });

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

    const list1 = items.find(
      (c) =>
        c.dbItem?.kind === DbItemKind.RemoteUserDefinedList &&
        c.dbItem?.listName === "my-list-1",
    );
    const list2 = items.find(
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

    const list2 = items.find(
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

    for (const item of items) {
      expect(isTreeViewItemSelectable(item)).toBeTruthy();
    }
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
});
