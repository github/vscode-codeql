import { expect } from 'chai';

import { DbConfig } from '../../../src/databases/config/db-config';
import { DbItemKind } from '../../../src/databases/db-item';
import { createLocalTree, createRemoteTree } from '../../../src/databases/db-tree-creator';

describe('db tree creator', () => {
  describe('createRemoteTree', () => {
    it('should build root node and system defined lists', () => {
      const dbConfig: DbConfig = {
        databases: {
          remote: {
            repositoryLists: [],
            owners: [],
            repositories: []
          },
          local: {
            lists: [],
            databases: []
          }
        },
      };

      const dbTreeRoot = createRemoteTree(dbConfig);

      expect(dbTreeRoot).to.be.ok;
      expect(dbTreeRoot.kind).to.equal(DbItemKind.RootRemote);
      expect(dbTreeRoot.children.length).to.equal(3);
      expect(dbTreeRoot.children[0]).to.deep.equal({
        kind: DbItemKind.RemoteSystemDefinedList,
        listName: 'top_10',
        listDisplayName: 'Top 10 repositories',
        listDescription: 'Top 10 repositories of a language'
      });
      expect(dbTreeRoot.children[1]).to.deep.equal({
        kind: DbItemKind.RemoteSystemDefinedList,
        listName: 'top_100',
        listDisplayName: 'Top 100 repositories',
        listDescription: 'Top 100 repositories of a language'
      });
      expect(dbTreeRoot.children[2]).to.deep.equal({
        kind: DbItemKind.RemoteSystemDefinedList,
        listName: 'top_1000',
        listDisplayName: 'Top 1000 repositories',
        listDescription: 'Top 1000 repositories of a language'
      });
    });

    it('should create remote user defined list nodes', () => {
      const dbConfig: DbConfig = {
        databases: {
          remote: {
            repositoryLists: [
              {
                name: 'my-list-1',
                repositories: [
                  'owner1/repo1',
                  'owner1/repo2',
                  'owner2/repo1'
                ]
              },
              {
                name: 'my-list-2',
                repositories: [
                  'owner3/repo1',
                  'owner3/repo2',
                  'owner4/repo1'
                ]
              }
            ],
            owners: [],
            repositories: []
          },
          local: {
            lists: [],
            databases: []
          },
        },
      };

      const dbTreeRoot = createRemoteTree(dbConfig);

      expect(dbTreeRoot).to.be.ok;
      expect(dbTreeRoot.kind).to.equal(DbItemKind.RootRemote);
      const repositoryListNodes = dbTreeRoot.children.filter(
        (child) => child.kind === DbItemKind.RemoteUserDefinedList
      );

      expect(repositoryListNodes.length).to.equal(2);
      expect(repositoryListNodes[0]).to.deep.equal({
        kind: DbItemKind.RemoteUserDefinedList,
        listName: dbConfig.databases.remote.repositoryLists[0].name,
        repos: dbConfig.databases.remote.repositoryLists[0].repositories.map((repo) => ({
          kind: DbItemKind.RemoteRepo,
          repoFullName: repo
        }))
      });
      expect(repositoryListNodes[1]).to.deep.equal({
        kind: DbItemKind.RemoteUserDefinedList,
        listName: dbConfig.databases.remote.repositoryLists[1].name,
        repos: dbConfig.databases.remote.repositoryLists[1].repositories.map((repo) => ({
          kind: DbItemKind.RemoteRepo,
          repoFullName: repo
        }))
      });
    });

    it('should create remote owner nodes', () => {
      const dbConfig: DbConfig = {
        databases: {
          remote: {
            repositoryLists: [],
            owners: [
              'owner1',
              'owner2'
            ],
            repositories: []
          },
          local: {
            lists: [],
            databases: []
          }
        }
      };

      const dbTreeRoot = createRemoteTree(dbConfig);

      expect(dbTreeRoot).to.be.ok;
      expect(dbTreeRoot.kind).to.equal(DbItemKind.RootRemote);
      const ownerNodes = dbTreeRoot.children.filter(
        (child) => child.kind === DbItemKind.RemoteOwner
      );

      expect(ownerNodes.length).to.equal(2);
      expect(ownerNodes[0]).to.deep.equal({
        kind: DbItemKind.RemoteOwner,
        ownerName: dbConfig.databases.remote.owners[0]
      });
      expect(ownerNodes[1]).to.deep.equal({
        kind: DbItemKind.RemoteOwner,
        ownerName: dbConfig.databases.remote.owners[1]
      });
    });

    it('should create remote repo nodes', () => {
      const dbConfig: DbConfig = {
        databases: {
          remote: {
            repositoryLists: [],
            owners: [],
            repositories: [
              'owner1/repo1',
              'owner1/repo2',
              'owner2/repo1'
            ]
          },
          local: {
            lists: [],
            databases: []
          },
        }
      };

      const dbTreeRoot = createRemoteTree(dbConfig);

      expect(dbTreeRoot).to.be.ok;
      expect(dbTreeRoot.kind).to.equal(DbItemKind.RootRemote);
      const repoNodes = dbTreeRoot.children.filter(
        (child) => child.kind === DbItemKind.RemoteRepo
      );

      expect(repoNodes.length).to.equal(3);
      expect(repoNodes[0]).to.deep.equal({
        kind: DbItemKind.RemoteRepo,
        repoFullName: dbConfig.databases.remote.repositories[0]
      });
      expect(repoNodes[1]).to.deep.equal({
        kind: DbItemKind.RemoteRepo,
        repoFullName: dbConfig.databases.remote.repositories[1]
      });
      expect(repoNodes[2]).to.deep.equal({
        kind: DbItemKind.RemoteRepo,
        repoFullName: dbConfig.databases.remote.repositories[2]
      });
    });
  });
  describe('createLocalTree', () => {
    it('should build root node', () => {
      const dbConfig: DbConfig = {
        databases: {
          remote: {
            repositoryLists: [],
            owners: [],
            repositories: []
          },
          local: {
            lists: [],
            databases: []
          }
        }
      };

      const dbTreeRoot = createLocalTree(dbConfig);

      expect(dbTreeRoot).to.be.ok;
      expect(dbTreeRoot.kind).to.equal(DbItemKind.RootLocal);
      expect(dbTreeRoot.children.length).to.equal(0);
    });

    it('should create local list nodes', () => {
      const dbConfig: DbConfig = {
        databases: {
          remote: {
            repositoryLists: [],
            owners: [],
            repositories: [],
          },
          local: {
            lists: [
              {
                name: 'my-list-1',
                databases: [
                  {
                    name: 'db1',
                    dateAdded: 1668428293677,
                    language: 'cpp',
                    storagePath: '/path/to/db1/',
                  },
                  {
                    name: 'db2',
                    dateAdded: 1668428472731,
                    language: 'cpp',
                    storagePath: '/path/to/db2/',
                  },
                ],
              },
              {
                name: 'my-list-2',
                databases: [
                  {
                    name: 'db3',
                    dateAdded: 1668428472731,
                    language: 'ruby',
                    storagePath: '/path/to/db3/',
                  },
                ],
              },
            ],
            databases: [],
          },
        },
      };

      const dbTreeRoot = createLocalTree(dbConfig);

      expect(dbTreeRoot).to.be.ok;
      expect(dbTreeRoot.kind).to.equal(DbItemKind.RootLocal);
      const localListNodes = dbTreeRoot.children.filter(
        (child) => child.kind === DbItemKind.LocalList
      );

      expect(localListNodes.length).to.equal(2);
      expect(localListNodes[0]).to.deep.equal({
        kind: DbItemKind.LocalList,
        listName: dbConfig.databases.local.lists[0].name,
        databases: dbConfig.databases.local.lists[0].databases.map((db) => ({
          kind: DbItemKind.LocalDatabase,
          databaseName: db.name,
          dateAdded: db.dateAdded,
          language: db.language,
          storagePath: db.storagePath,
        }))
      });
      expect(localListNodes[1]).to.deep.equal({
        kind: DbItemKind.LocalList,
        listName: dbConfig.databases.local.lists[1].name,
        databases: dbConfig.databases.local.lists[1].databases.map((db) => ({
          kind: DbItemKind.LocalDatabase,
          databaseName: db.name,
          dateAdded: db.dateAdded,
          language: db.language,
          storagePath: db.storagePath,
        }))
      });
    });

    it('should create local database nodes', () => {
      const dbConfig: DbConfig = {
        databases: {
          remote: {
            repositoryLists: [],
            owners: [],
            repositories: []
          },
          local: {
            lists: [],
            databases: [
              {
                name: 'db1',
                dateAdded: 1668428293677,
                language: 'csharp',
                storagePath: '/path/to/db1/',
              },
              {
                name: 'db2',
                dateAdded: 1668428472731,
                language: 'go',
                storagePath: '/path/to/db2/',
              }
            ]
          }
        }
      };

      const dbTreeRoot = createLocalTree(dbConfig);

      expect(dbTreeRoot).to.be.ok;
      expect(dbTreeRoot.kind).to.equal(DbItemKind.RootLocal);
      const localDatabaseNodes = dbTreeRoot.children.filter(
        (child) => child.kind === DbItemKind.LocalDatabase
      );

      expect(localDatabaseNodes.length).to.equal(2);
      expect(localDatabaseNodes[0]).to.deep.equal({
        kind: DbItemKind.LocalDatabase,
        databaseName: dbConfig.databases.local.databases[0].name,
        dateAdded: dbConfig.databases.local.databases[0].dateAdded,
        language: dbConfig.databases.local.databases[0].language,
        storagePath: dbConfig.databases.local.databases[0].storagePath,
      });
      expect(localDatabaseNodes[1]).to.deep.equal({
        kind: DbItemKind.LocalDatabase,
        databaseName: dbConfig.databases.local.databases[1].name,
        dateAdded: dbConfig.databases.local.databases[1].dateAdded,
        language: dbConfig.databases.local.databases[1].language,
        storagePath: dbConfig.databases.local.databases[1].storagePath,
      });
    });
  });
});
