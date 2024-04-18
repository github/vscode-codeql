import { TreeItemCollapsibleState, ThemeIcon, ThemeColor } from "vscode";
import { join } from "path";
import { ensureDir, remove, writeJson } from "fs-extra";
import type { DbConfig } from "../../../../src/databases/config/db-config";
import { DbManager } from "../../../../src/databases/db-manager";
import { DbConfigStore } from "../../../../src/databases/config/db-config-store";
import { DbTreeDataProvider } from "../../../../src/databases/ui/db-tree-data-provider";
import type { DbTreeViewItem } from "../../../../src/databases/ui/db-tree-view-item";
import { ExtensionApp } from "../../../../src/common/vscode/extension-app";
import { createMockExtensionContext } from "../../../factories/extension-context";
import { createDbConfig } from "../../../factories/db-config-factories";
import { setRemoteControllerRepo } from "../../../../src/config";
import { createMockVariantAnalysisConfig } from "../../../factories/config";

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
});
