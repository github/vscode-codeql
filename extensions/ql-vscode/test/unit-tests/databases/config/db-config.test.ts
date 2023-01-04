import {
  LocalList,
  renameLocalDb,
  renameLocalList,
  renameRemoteList,
  SelectedDbItemKind,
} from "../../../../src/databases/config/db-config";
import {
  createDbConfig,
  createLocalDbConfigItem,
} from "../../../factories/db-config-factories";

describe("db config", () => {
  describe("renameLocalList", () => {
    it("should rename a local list", () => {
      const originalConfig = createDbConfig({
        localLists: [
          {
            name: "list1",
            databases: [],
          },
          {
            name: "list2",
            databases: [],
          },
        ],
      });

      const updatedConfig = renameLocalList(
        originalConfig,
        "list1",
        "listRenamed",
      );

      expect(updatedConfig.databases.local.lists).toEqual([
        {
          name: "listRenamed",
          databases: [],
        },
        {
          name: "list2",
          databases: [],
        },
      ]);
    });

    it("should rename a selected local list", () => {
      const originalConfig = createDbConfig({
        localLists: [
          {
            name: "list1",
            databases: [],
          },
          {
            name: "list2",
            databases: [],
          },
        ],
        selected: {
          kind: SelectedDbItemKind.LocalUserDefinedList,
          listName: "list1",
        },
      });

      const updatedConfig = renameLocalList(
        originalConfig,
        "list1",
        "listRenamed",
      );

      expect(updatedConfig.databases.local.lists).toEqual([
        {
          name: "listRenamed",
          databases: [],
        },
        {
          name: "list2",
          databases: [],
        },
      ]);

      expect(updatedConfig.selected).toEqual({
        kind: SelectedDbItemKind.LocalUserDefinedList,
        listName: "listRenamed",
      });
    });

    it("should rename a local list with a db that is selected", () => {
      const selectedLocalDb = createLocalDbConfigItem();
      const list1: LocalList = {
        name: "list1",
        databases: [
          createLocalDbConfigItem(),
          selectedLocalDb,
          createLocalDbConfigItem(),
        ],
      };
      const list2: LocalList = {
        name: "list2",
        databases: [],
      };

      const originalConfig = createDbConfig({
        localLists: [list1, list2],
        selected: {
          kind: SelectedDbItemKind.LocalDatabase,
          databaseName: selectedLocalDb.name,
          listName: list1.name,
        },
      });

      const updatedConfig = renameLocalList(
        originalConfig,
        list1.name,
        "listRenamed",
      );

      expect(updatedConfig.databases.local.lists.length).toEqual(2);
      expect(updatedConfig.databases.local.lists[0]).toEqual({
        ...list1,
        name: "listRenamed",
      });
      expect(updatedConfig.databases.local.lists[1]).toEqual(list2);

      expect(updatedConfig.selected).toEqual({
        kind: SelectedDbItemKind.LocalDatabase,
        databaseName: selectedLocalDb.name,
        listName: "listRenamed",
      });
    });
  });

  describe("renameRemoteList", () => {
    it("should rename a remote list", () => {
      const originalConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: [],
          },
          {
            name: "list2",
            repositories: [],
          },
        ],
      });

      const updatedConfig = renameRemoteList(
        originalConfig,
        "list1",
        "listRenamed",
      );

      expect(updatedConfig.databases.remote.repositoryLists).toEqual([
        {
          name: "listRenamed",
          repositories: [],
        },
        {
          name: "list2",
          repositories: [],
        },
      ]);
    });

    it("should rename a selected remote list", () => {
      const originalConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: [],
          },
          {
            name: "list2",
            repositories: [],
          },
        ],
        selected: {
          kind: SelectedDbItemKind.RemoteUserDefinedList,
          listName: "list1",
        },
      });

      const updatedConfig = renameRemoteList(
        originalConfig,
        "list1",
        "listRenamed",
      );

      expect(updatedConfig.databases.remote.repositoryLists).toEqual([
        {
          name: "listRenamed",
          repositories: [],
        },
        {
          name: "list2",
          repositories: [],
        },
      ]);

      expect(updatedConfig.selected).toEqual({
        kind: SelectedDbItemKind.RemoteUserDefinedList,
        listName: "listRenamed",
      });
    });

    it("should rename a remote list with a db that is selected", () => {
      const selectedRemoteRepo = "owner/repo2";
      const originalConfig = createDbConfig({
        remoteLists: [
          {
            name: "list1",
            repositories: ["owner1/repo1", selectedRemoteRepo, "owner1/repo3"],
          },
          {
            name: "list2",
            repositories: [],
          },
        ],
        selected: {
          kind: SelectedDbItemKind.RemoteRepository,
          repositoryName: selectedRemoteRepo,
          listName: "list1",
        },
      });

      const updatedConfig = renameRemoteList(
        originalConfig,
        "list1",
        "listRenamed",
      );
      const updatedRepositoryLists =
        updatedConfig.databases.remote.repositoryLists;

      expect(updatedRepositoryLists.length).toEqual(2);
      expect(updatedRepositoryLists[0]).toEqual({
        ...originalConfig.databases.remote.repositoryLists[0],
        name: "listRenamed",
      });
      expect(updatedRepositoryLists[1]).toEqual(
        originalConfig.databases.remote.repositoryLists[1],
      );

      expect(updatedConfig.selected).toEqual({
        kind: SelectedDbItemKind.RemoteRepository,
        repositoryName: selectedRemoteRepo,
        listName: "listRenamed",
      });
    });
  });

  describe("renameLocalDb", () => {
    it("should rename a local db", () => {
      const db1 = createLocalDbConfigItem({ name: "db1" });
      const db2 = createLocalDbConfigItem({ name: "db2" });

      const originalConfig = createDbConfig({
        localLists: [
          {
            name: "list1",
            databases: [
              createLocalDbConfigItem({ name: "db1" }),
              createLocalDbConfigItem({ name: "db2" }),
            ],
          },
        ],
        localDbs: [db1, db2],
      });

      const updatedConfig = renameLocalDb(originalConfig, "db1", "dbRenamed");

      const updatedLocalDbs = updatedConfig.databases.local;
      const originalLocalDbs = originalConfig.databases.local;

      expect(updatedLocalDbs.lists).toEqual(originalLocalDbs.lists);
      expect(updatedLocalDbs.databases.length).toEqual(2);
      expect(updatedLocalDbs.databases[0]).toEqual({
        ...db1,
        name: "dbRenamed",
      });
      expect(updatedLocalDbs.databases[1]).toEqual(db2);
    });

    it("should rename a local db inside a list", () => {
      const db1List1 = createLocalDbConfigItem({ name: "db1" });
      const db2List1 = createLocalDbConfigItem({ name: "db2" });

      const originalConfig = createDbConfig({
        localLists: [
          {
            name: "list1",
            databases: [db1List1, db2List1],
          },
          {
            name: "list2",
            databases: [
              createLocalDbConfigItem({ name: "db1" }),
              createLocalDbConfigItem({ name: "db2" }),
            ],
          },
        ],
        localDbs: [
          createLocalDbConfigItem({ name: "db1" }),
          createLocalDbConfigItem({ name: "db2" }),
        ],
      });

      const updatedConfig = renameLocalDb(
        originalConfig,
        db1List1.name,
        "dbRenamed",
        "list1",
      );

      const updatedLocalDbs = updatedConfig.databases.local;
      const originalLocalDbs = originalConfig.databases.local;
      expect(updatedLocalDbs.databases).toEqual(originalLocalDbs.databases);
      expect(updatedLocalDbs.lists.length).toEqual(2);
      expect(updatedLocalDbs.lists[0].databases.length).toEqual(2);
      expect(updatedLocalDbs.lists[0].databases[0]).toEqual({
        ...db1List1,
        name: "dbRenamed",
      });
      expect(updatedLocalDbs.lists[0].databases[1]).toEqual(db2List1);
      expect(updatedLocalDbs.lists[1]).toEqual(originalLocalDbs.lists[1]);
    });

    it("should rename a local db that is selected", () => {
      const db1 = createLocalDbConfigItem({ name: "db1" });
      const db2 = createLocalDbConfigItem({ name: "db2" });

      const originalConfig = createDbConfig({
        localLists: [
          {
            name: "list1",
            databases: [
              createLocalDbConfigItem({ name: "db1" }),
              createLocalDbConfigItem({ name: "db2" }),
            ],
          },
        ],
        localDbs: [db1, db2],
        selected: {
          kind: SelectedDbItemKind.LocalDatabase,
          databaseName: "db1",
        },
      });

      const updatedConfig = renameLocalDb(originalConfig, "db1", "dbRenamed");

      const updatedLocalDbs = updatedConfig.databases.local;
      const originalLocalDbs = originalConfig.databases.local;

      expect(updatedLocalDbs.lists).toEqual(originalLocalDbs.lists);
      expect(updatedLocalDbs.databases.length).toEqual(2);
      expect(updatedLocalDbs.databases[0]).toEqual({
        ...db1,
        name: "dbRenamed",
      });
      expect(updatedLocalDbs.databases[1]).toEqual(db2);
    });
  });
});
