import { ensureDir, remove, pathExists } from "fs-extra";
import { join } from "path";
import { DbConfigStore } from "../../../../src/databases/config/db-config-store";
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

  it("should create a new config if one does not exist", async () => {
    const app = createMockApp({
      extensionPath,
      workspaceStoragePath: tempWorkspaceStoragePath,
    });

    const configPath = join(
      tempWorkspaceStoragePath,
      "workspace-databases.json",
    );

    const configStore = new DbConfigStore(app);
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
    const configStore = new DbConfigStore(app);
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
      kind: "configDefined",
      value: "path.to.database",
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

    const configStore = new DbConfigStore(app);
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
    const configStore = new DbConfigStore(app);
    await configStore.initialize();

    const config = configStore.getConfig().value;
    config.databases.remote.repositoryLists = [];

    const reRetrievedConfig = configStore.getConfig().value;
    expect(reRetrievedConfig.databases.remote.repositoryLists).toHaveLength(1);

    configStore.dispose();
  });
});
