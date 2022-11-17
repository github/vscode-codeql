import * as fs from "fs-extra";
import * as path from "path";
import { DbConfigStore } from "../../../../src/databases/config/db-config-store";
import { expect } from "chai";
import { createMockApp } from "../../../__mocks__/appMock";

describe("db config store", async () => {
  const extensionPath = path.join(__dirname, "../../../..");
  const tempWorkspaceStoragePath = path.join(__dirname, "test-workspace");
  const testDataStoragePath = path.join(__dirname, "data");

  beforeEach(async () => {
    await fs.ensureDir(tempWorkspaceStoragePath);
  });

  afterEach(async () => {
    await fs.remove(tempWorkspaceStoragePath);
  });

  it("should create a new config if one does not exist", async () => {
    const app = createMockApp({
      extensionPath,
      workspaceStoragePath: tempWorkspaceStoragePath,
    });

    const configPath = path.join(
      tempWorkspaceStoragePath,
      "workspace-databases.json",
    );

    const configStore = new DbConfigStore(app);
    await configStore.initialize();

    expect(await fs.pathExists(configPath)).to.be.true;

    const config = configStore.getConfig().value;
    expect(config.databases.remote.repositoryLists).to.be.empty;
    expect(config.databases.remote.owners).to.be.empty;
    expect(config.databases.remote.repositories).to.be.empty;
    expect(config.databases.local.lists).to.be.empty;
    expect(config.databases.local.databases).to.be.empty;
    expect(config.selected).to.be.undefined;
  });

  it("should load an existing config", async () => {
    const app = createMockApp({
      extensionPath,
      workspaceStoragePath: testDataStoragePath,
    });
    const configStore = new DbConfigStore(app);
    await configStore.initialize();

    const config = configStore.getConfig().value;
    expect(config.databases.remote.repositoryLists).to.have.length(1);
    expect(config.databases.remote.repositoryLists[0]).to.deep.equal({
      name: "repoList1",
      repositories: ["foo/bar", "foo/baz"],
    });
    expect(config.databases.remote.owners).to.be.empty;
    expect(config.databases.remote.repositories).to.have.length(3);
    expect(config.databases.remote.repositories).to.deep.equal([
      "owner/repo1",
      "owner/repo2",
      "owner/repo3",
    ]);
    expect(config.databases.local.lists).to.have.length(2);
    expect(config.databases.local.lists[0]).to.deep.equal({
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
    expect(config.databases.local.databases).to.have.length(1);
    expect(config.databases.local.databases[0]).to.deep.equal({
      name: "example-db",
      dateAdded: 1668096927267,
      language: "ruby",
      storagePath: "/path/to/database/",
    });
    expect(config.selected).to.deep.equal({
      kind: "configDefined",
      value: "path.to.database",
    });
  });

  it("should load an existing config without selected db", async () => {
    const testDataStoragePathWithout = path.join(
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
    expect(config.selected).to.be.undefined;
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
    expect(reRetrievedConfig.databases.remote.repositoryLists).to.have.length(
      1,
    );
  });
});
