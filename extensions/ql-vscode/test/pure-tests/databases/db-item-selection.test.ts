import { DbItem, DbItemKind } from "../../../src/databases/db-item";
import { getSelectedDbItem } from "../../../src/databases/db-item-selection";
describe("db item selection", () => {
  it("dhoulf return undefined if no item is selected", () => {
    const dbItems: DbItem[] = [
      {
        kind: DbItemKind.RootRemote,
        children: [
          {
            kind: DbItemKind.RemoteSystemDefinedList,
            listName: "top_10",
            listDisplayName: "Top 10 repositories",
            listDescription: "Top 10 repositories of a language",
            selected: false,
          },
          {
            kind: DbItemKind.RemoteSystemDefinedList,
            listName: "top_100",
            listDisplayName: "Top 100 repositories",
            listDescription: "Top 100 repositories of a language",
            selected: false,
          },
          {
            kind: DbItemKind.RemoteOwner,
            ownerName: "github",
            selected: false,
          },
          {
            kind: DbItemKind.RemoteUserDefinedList,
            listName: "my list",
            repos: [
              {
                kind: DbItemKind.RemoteRepo,
                repoFullName: "owner1/repo2",
                selected: false,
              },
              {
                kind: DbItemKind.RemoteRepo,
                repoFullName: "owner1/repo3",
                selected: false,
              },
            ],
            selected: false,
          },
        ],
      },
      {
        kind: DbItemKind.RootLocal,
        children: [
          {
            kind: DbItemKind.LocalList,
            listName: "list-1",
            databases: [
              {
                kind: DbItemKind.LocalDatabase,
                databaseName: "db1",
                dateAdded: 1234,
                language: "javascript",
                storagePath: "/foo/bar",
                selected: false,
              },
              {
                kind: DbItemKind.LocalDatabase,
                databaseName: "db2",
                dateAdded: 1234,
                language: "javascript",
                storagePath: "/foo/bar",
                selected: false,
              },
            ],
            selected: false,
          },
          {
            kind: DbItemKind.LocalDatabase,
            databaseName: "db3",
            dateAdded: 1234,
            language: "javascript",
            storagePath: "/foo/bar",
            selected: false,
          },
        ],
      },
    ];

    expect(getSelectedDbItem(dbItems)).toBeUndefined();
  });

  it("should return correct local database item from DbItem list", () => {
    const dbItems: DbItem[] = [
      {
        kind: DbItemKind.RootLocal,
        children: [
          {
            kind: DbItemKind.LocalList,
            listName: "list-1",
            databases: [
              {
                kind: DbItemKind.LocalDatabase,
                databaseName: "db1",
                dateAdded: 1234,
                language: "javascript",
                storagePath: "/foo/bar",
                selected: false,
              },
              {
                kind: DbItemKind.LocalDatabase,
                databaseName: "db2",
                dateAdded: 1234,
                language: "javascript",
                storagePath: "/foo/bar",
                selected: true,
              },
            ],
            selected: false,
          },
          {
            kind: DbItemKind.LocalDatabase,
            databaseName: "db3",
            dateAdded: 1234,
            language: "javascript",
            storagePath: "/foo/bar",
            selected: false,
          },
        ],
      },
    ];

    expect(getSelectedDbItem(dbItems)).toEqual({
      kind: DbItemKind.LocalDatabase,
      databaseName: "db2",
      dateAdded: 1234,
      language: "javascript",
      storagePath: "/foo/bar",
      selected: true,
    });
  });

  it("should return correct remote database list item from DbItem list", () => {
    const dbItems: DbItem[] = [
      {
        kind: DbItemKind.RootRemote,
        children: [
          {
            kind: DbItemKind.RemoteSystemDefinedList,
            listName: "top_10",
            listDisplayName: "Top 10 repositories",
            listDescription: "Top 10 repositories of a language",
            selected: false,
          },
          {
            kind: DbItemKind.RemoteOwner,
            ownerName: "github",
            selected: false,
          },
          {
            kind: DbItemKind.RemoteUserDefinedList,
            listName: "my list",
            repos: [
              {
                kind: DbItemKind.RemoteRepo,
                repoFullName: "owner1/repo2",
                selected: false,
              },
              {
                kind: DbItemKind.RemoteRepo,
                repoFullName: "owner1/repo3",
                selected: false,
              },
            ],
            selected: true,
          },
        ],
      },
    ];

    expect(getSelectedDbItem(dbItems)).toEqual({
      kind: DbItemKind.RemoteUserDefinedList,
      listName: "my list",
      repos: [
        {
          kind: DbItemKind.RemoteRepo,
          repoFullName: "owner1/repo2",
          selected: false,
        },
        {
          kind: DbItemKind.RemoteRepo,
          repoFullName: "owner1/repo3",
          selected: false,
        },
      ],
      selected: true,
    });
  });
});
