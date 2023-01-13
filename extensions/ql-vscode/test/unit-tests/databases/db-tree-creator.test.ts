import {
  DbConfig,
  SelectedDbItemKind,
} from "../../../src/databases/config/db-config";
import {
  DbItemKind,
  isRemoteOwnerDbItem,
  isRemoteRepoDbItem,
  isVariantAnalysisUserDefinedListDbItem,
} from "../../../src/databases/db-item";
import {
  ExpandedDbItem,
  ExpandedDbItemKind,
} from "../../../src/databases/db-item-expansion";
import {
  createLocalTree,
  createRemoteTree,
} from "../../../src/databases/db-tree-creator";
import { createDbConfig } from "../../factories/db-config-factories";

describe("db tree creator", () => {
  describe("createRemoteTree", () => {
    it("should build root node and system defined lists", () => {
      const dbConfig = createDbConfig();

      const dbTreeRoot = createRemoteTree(dbConfig, []);

      expect(dbTreeRoot).toBeTruthy();
      expect(dbTreeRoot.kind).toBe(DbItemKind.RootRemote);
      expect(dbTreeRoot.expanded).toBe(false);
      expect(dbTreeRoot.children.length).toBe(3);
      expect(dbTreeRoot.children[0]).toEqual({
        kind: DbItemKind.RemoteSystemDefinedList,
        selected: false,
        listName: "top_10",
        listDisplayName: "Top 10 repositories",
        listDescription: "Top 10 repositories of a language",
      });
      expect(dbTreeRoot.children[1]).toEqual({
        kind: DbItemKind.RemoteSystemDefinedList,
        selected: false,
        listName: "top_100",
        listDisplayName: "Top 100 repositories",
        listDescription: "Top 100 repositories of a language",
      });
      expect(dbTreeRoot.children[2]).toEqual({
        kind: DbItemKind.RemoteSystemDefinedList,
        selected: false,
        listName: "top_1000",
        listDisplayName: "Top 1000 repositories",
        listDescription: "Top 1000 repositories of a language",
      });
    });

    it("should create remote user defined list nodes", () => {
      const dbConfig = createDbConfig({
        remoteLists: [
          {
            name: "my-list-1",
            repositories: ["owner1/repo1", "owner1/repo2", "owner2/repo1"],
          },
          {
            name: "my-list-2",
            repositories: ["owner3/repo1", "owner3/repo2", "owner4/repo1"],
          },
        ],
      });

      const dbTreeRoot = createRemoteTree(dbConfig, []);

      expect(dbTreeRoot).toBeTruthy();
      expect(dbTreeRoot.kind).toBe(DbItemKind.RootRemote);
      const repositoryListNodes = dbTreeRoot.children.filter(
        isVariantAnalysisUserDefinedListDbItem,
      );

      expect(repositoryListNodes.length).toBe(2);
      expect(repositoryListNodes[0]).toEqual({
        kind: DbItemKind.VariantAnalysisUserDefinedList,
        selected: false,
        expanded: false,
        listName: dbConfig.databases.variantAnalysis.repositoryLists[0].name,
        repos:
          dbConfig.databases.variantAnalysis.repositoryLists[0].repositories.map(
            (repo) => ({
              kind: DbItemKind.RemoteRepo,
              selected: false,
              repoFullName: repo,
              parentListName:
                dbConfig.databases.variantAnalysis.repositoryLists[0].name,
            }),
          ),
      });
      expect(repositoryListNodes[1]).toEqual({
        kind: DbItemKind.VariantAnalysisUserDefinedList,
        selected: false,
        expanded: false,
        listName: dbConfig.databases.variantAnalysis.repositoryLists[1].name,
        repos:
          dbConfig.databases.variantAnalysis.repositoryLists[1].repositories.map(
            (repo) => ({
              kind: DbItemKind.RemoteRepo,
              selected: false,
              repoFullName: repo,
              parentListName:
                dbConfig.databases.variantAnalysis.repositoryLists[1].name,
            }),
          ),
      });
    });

    it("should create remote owner nodes", () => {
      const dbConfig: DbConfig = createDbConfig({
        remoteOwners: ["owner1", "owner2"],
      });

      const dbTreeRoot = createRemoteTree(dbConfig, []);

      expect(dbTreeRoot).toBeTruthy();
      expect(dbTreeRoot.kind).toBe(DbItemKind.RootRemote);
      const ownerNodes = dbTreeRoot.children.filter(isRemoteOwnerDbItem);

      expect(ownerNodes.length).toBe(2);
      expect(ownerNodes[0]).toEqual({
        kind: DbItemKind.RemoteOwner,
        selected: false,
        ownerName: dbConfig.databases.variantAnalysis.owners[0],
      });
      expect(ownerNodes[1]).toEqual({
        kind: DbItemKind.RemoteOwner,
        selected: false,
        ownerName: dbConfig.databases.variantAnalysis.owners[1],
      });
    });

    it("should create remote repo nodes", () => {
      const dbConfig = createDbConfig({
        remoteRepos: ["owner1/repo1", "owner1/repo2", "owner2/repo1"],
      });

      const dbTreeRoot = createRemoteTree(dbConfig, []);

      expect(dbTreeRoot).toBeTruthy();
      expect(dbTreeRoot.kind).toBe(DbItemKind.RootRemote);
      const repoNodes = dbTreeRoot.children.filter(isRemoteRepoDbItem);

      expect(repoNodes.length).toBe(3);
      expect(repoNodes[0]).toEqual({
        kind: DbItemKind.RemoteRepo,
        selected: false,
        repoFullName: dbConfig.databases.variantAnalysis.repositories[0],
      });
      expect(repoNodes[1]).toEqual({
        kind: DbItemKind.RemoteRepo,
        selected: false,
        repoFullName: dbConfig.databases.variantAnalysis.repositories[1],
      });
      expect(repoNodes[2]).toEqual({
        kind: DbItemKind.RemoteRepo,
        selected: false,
        repoFullName: dbConfig.databases.variantAnalysis.repositories[2],
      });
    });

    describe("selected db item", () => {
      it("should allow selecting a remote user defined list node", () => {
        const dbConfig = createDbConfig({
          remoteLists: [
            {
              name: "my-list-1",
              repositories: ["owner1/repo1", "owner1/repo2", "owner2/repo1"],
            },
          ],
          selected: {
            kind: SelectedDbItemKind.VariantAnalysisUserDefinedList,
            listName: "my-list-1",
          },
        });

        const dbTreeRoot = createRemoteTree(dbConfig, []);

        expect(dbTreeRoot).toBeTruthy();
        expect(dbTreeRoot.kind).toBe(DbItemKind.RootRemote);
        const repositoryListNodes = dbTreeRoot.children.filter(
          (child) => child.kind === DbItemKind.VariantAnalysisUserDefinedList,
        );

        expect(repositoryListNodes.length).toBe(1);
        expect(repositoryListNodes[0].selected).toEqual(true);
      });

      it("should allow selecting a remote owner node", () => {
        const dbConfig = createDbConfig({
          remoteOwners: ["owner1", "owner2"],
          selected: {
            kind: SelectedDbItemKind.VariantAnalysisOwner,
            ownerName: "owner1",
          },
        });

        const dbTreeRoot = createRemoteTree(dbConfig, []);

        expect(dbTreeRoot).toBeTruthy();
        expect(dbTreeRoot.kind).toBe(DbItemKind.RootRemote);
        const ownerNodes = dbTreeRoot.children.filter(
          (child) => child.kind === DbItemKind.RemoteOwner,
        );

        expect(ownerNodes.length).toBe(2);
        expect(ownerNodes[0].selected).toEqual(true);
        expect(ownerNodes[1].selected).toEqual(false);
      });

      it("should allow selecting a remote repo node", () => {
        const dbConfig = createDbConfig({
          remoteRepos: ["owner1/repo1", "owner1/repo2"],
          selected: {
            kind: SelectedDbItemKind.VariantAnalysisRepository,
            repositoryName: "owner1/repo2",
          },
        });

        const dbTreeRoot = createRemoteTree(dbConfig, []);

        expect(dbTreeRoot).toBeTruthy();
        expect(dbTreeRoot.kind).toBe(DbItemKind.RootRemote);
        const repoNodes = dbTreeRoot.children.filter(isRemoteRepoDbItem);

        expect(repoNodes.length).toBe(2);
        expect(repoNodes[0].selected).toEqual(false);
        expect(repoNodes[1].selected).toEqual(true);
      });

      it("should allow selecting a remote repo in a list", () => {
        const dbConfig = createDbConfig({
          remoteLists: [
            {
              name: "my-list-1",
              repositories: ["owner1/repo1"],
            },
          ],
          remoteRepos: ["owner1/repo2"],
          selected: {
            kind: SelectedDbItemKind.VariantAnalysisRepository,
            listName: "my-list-1",
            repositoryName: "owner1/repo1",
          },
        });

        const dbTreeRoot = createRemoteTree(dbConfig, []);

        expect(dbTreeRoot).toBeTruthy();

        const listNodes = dbTreeRoot.children.filter(
          isVariantAnalysisUserDefinedListDbItem,
        );

        expect(listNodes.length).toBe(1);
        expect(listNodes[0].selected).toEqual(false);
        expect(listNodes[0].repos.length).toBe(1);
        expect(listNodes[0].repos[0].repoFullName).toBe("owner1/repo1");
        expect(listNodes[0].repos[0].selected).toBe(true);
      });
    });

    describe("expanded db items", () => {
      it("should allow expanding the root remote list node", () => {
        const dbConfig = createDbConfig();
        const expanded: ExpandedDbItem[] = [
          {
            kind: ExpandedDbItemKind.RootRemote,
          },
        ];

        const dbTreeRoot = createRemoteTree(dbConfig, expanded);

        expect(dbTreeRoot).toBeTruthy();
        expect(dbTreeRoot.kind).toBe(DbItemKind.RootRemote);
        expect(dbTreeRoot.expanded).toBe(true);
      });

      it("should allow expanding a remote user defined list node", () => {
        const dbConfig = createDbConfig({
          remoteLists: [
            {
              name: "my-list-1",
              repositories: ["owner1/repo1", "owner1/repo2", "owner2/repo1"],
            },
          ],
        });
        const expanded: ExpandedDbItem[] = [
          {
            kind: ExpandedDbItemKind.RootRemote,
          },
          {
            kind: ExpandedDbItemKind.RemoteUserDefinedList,
            listName: "my-list-1",
          },
        ];

        const dbTreeRoot = createRemoteTree(dbConfig, expanded);

        expect(dbTreeRoot).toBeTruthy();
        expect(dbTreeRoot.kind).toBe(DbItemKind.RootRemote);
        expect(dbTreeRoot.expanded).toBe(true);
        const repositoryListNodes = dbTreeRoot.children.filter(
          isVariantAnalysisUserDefinedListDbItem,
        );

        expect(repositoryListNodes.length).toBe(1);
        expect(repositoryListNodes[0].expanded).toEqual(true);
      });
    });
  });

  describe("createLocalTree", () => {
    it("should build root node", () => {
      const dbConfig = createDbConfig();

      const dbTreeRoot = createLocalTree(dbConfig, []);

      expect(dbTreeRoot).toBeTruthy();
      expect(dbTreeRoot.kind).toBe(DbItemKind.RootLocal);
      expect(dbTreeRoot.expanded).toBe(false);
      expect(dbTreeRoot.children.length).toBe(0);
    });

    it("should create local list nodes", () => {
      const dbConfig = createDbConfig({
        localLists: [
          {
            name: "my-list-1",
            databases: [
              {
                name: "db1",
                dateAdded: 1668428293677,
                language: "cpp",
                storagePath: "/path/to/db1/",
              },
              {
                name: "db2",
                dateAdded: 1668428472731,
                language: "cpp",
                storagePath: "/path/to/db2/",
              },
            ],
          },
          {
            name: "my-list-2",
            databases: [
              {
                name: "db3",
                dateAdded: 1668428472731,
                language: "ruby",
                storagePath: "/path/to/db3/",
              },
            ],
          },
        ],
      });

      const dbTreeRoot = createLocalTree(dbConfig, []);

      expect(dbTreeRoot).toBeTruthy();
      expect(dbTreeRoot.kind).toBe(DbItemKind.RootLocal);
      const localListNodes = dbTreeRoot.children.filter(
        (child) => child.kind === DbItemKind.LocalList,
      );

      expect(localListNodes.length).toBe(2);
      expect(localListNodes[0]).toEqual({
        kind: DbItemKind.LocalList,
        expanded: false,
        selected: false,
        listName: dbConfig.databases.local.lists[0].name,
        databases: dbConfig.databases.local.lists[0].databases.map((db) => ({
          kind: DbItemKind.LocalDatabase,
          selected: false,
          databaseName: db.name,
          dateAdded: db.dateAdded,
          language: db.language,
          storagePath: db.storagePath,
          parentListName: dbConfig.databases.local.lists[0].name,
        })),
      });
      expect(localListNodes[1]).toEqual({
        kind: DbItemKind.LocalList,
        expanded: false,
        selected: false,
        listName: dbConfig.databases.local.lists[1].name,
        databases: dbConfig.databases.local.lists[1].databases.map((db) => ({
          kind: DbItemKind.LocalDatabase,
          selected: false,
          databaseName: db.name,
          dateAdded: db.dateAdded,
          language: db.language,
          storagePath: db.storagePath,
          parentListName: dbConfig.databases.local.lists[1].name,
        })),
      });
    });

    it("should create local database nodes", () => {
      const dbConfig: DbConfig = createDbConfig({
        localDbs: [
          {
            name: "db1",
            dateAdded: 1668428293677,
            language: "csharp",
            storagePath: "/path/to/db1/",
          },
          {
            name: "db2",
            dateAdded: 1668428472731,
            language: "go",
            storagePath: "/path/to/db2/",
          },
        ],
      });

      const dbTreeRoot = createLocalTree(dbConfig, []);

      expect(dbTreeRoot).toBeTruthy();
      expect(dbTreeRoot.kind).toBe(DbItemKind.RootLocal);
      const localDatabaseNodes = dbTreeRoot.children.filter(
        (child) => child.kind === DbItemKind.LocalDatabase,
      );

      expect(localDatabaseNodes.length).toBe(2);
      expect(localDatabaseNodes[0]).toEqual({
        kind: DbItemKind.LocalDatabase,
        selected: false,
        databaseName: dbConfig.databases.local.databases[0].name,
        dateAdded: dbConfig.databases.local.databases[0].dateAdded,
        language: dbConfig.databases.local.databases[0].language,
        storagePath: dbConfig.databases.local.databases[0].storagePath,
      });
      expect(localDatabaseNodes[1]).toEqual({
        kind: DbItemKind.LocalDatabase,
        selected: false,
        databaseName: dbConfig.databases.local.databases[1].name,
        dateAdded: dbConfig.databases.local.databases[1].dateAdded,
        language: dbConfig.databases.local.databases[1].language,
        storagePath: dbConfig.databases.local.databases[1].storagePath,
      });
    });
  });
});
