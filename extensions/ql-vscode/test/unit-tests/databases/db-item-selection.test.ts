import { DbItem, DbItemKind } from "../../../src/databases/db-item";
import { getSelectedDbItem } from "../../../src/databases/db-item-selection";
import {
  createLocalDatabaseDbItem,
  createLocalListDbItem,
  createRemoteOwnerDbItem,
  createRemoteRepoDbItem,
  createRemoteSystemDefinedListDbItem,
  createRemoteUserDefinedListDbItem,
  createRootLocalDbItem,
  createRootRemoteDbItem,
} from "../../factories/db-item-factories";

describe("db item selection", () => {
  it("should return undefined if no item is selected", () => {
    const dbItems: DbItem[] = [
      createRootRemoteDbItem({
        children: [
          createRemoteSystemDefinedListDbItem(),
          createRemoteOwnerDbItem(),
          createRemoteUserDefinedListDbItem(),
        ],
      }),
      createRootLocalDbItem({
        children: [createLocalListDbItem(), createLocalDatabaseDbItem()],
      }),
    ];

    expect(getSelectedDbItem(dbItems)).toBeUndefined();
  });

  it("should return correct local database item from DbItem list", () => {
    const dbItems: DbItem[] = [
      createRootLocalDbItem({
        children: [
          createLocalDatabaseDbItem({
            databaseName: "db2",
            dateAdded: 1234,
            language: "javascript",
            storagePath: "/foo/bar",
            selected: true,
          }),
          createLocalListDbItem({
            databases: [
              createLocalDatabaseDbItem(),
              createLocalDatabaseDbItem(),
            ],
          }),
        ],
        expanded: false,
      }),
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
      createRootRemoteDbItem({
        children: [
          createRemoteSystemDefinedListDbItem(),
          createRemoteOwnerDbItem(),
          createRemoteUserDefinedListDbItem({
            listName: "my list",
            selected: true,
            repos: [
              createRemoteRepoDbItem({ repoFullName: "owner1/repo2" }),
              createRemoteRepoDbItem({ repoFullName: "owner1/repo3" }),
            ],
          }),
        ],
      }),
    ];

    expect(getSelectedDbItem(dbItems)).toEqual({
      kind: DbItemKind.RemoteUserDefinedList,
      expanded: false,
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

  it("should handle arbitrary list of db items", () => {
    const dbItems: DbItem[] = [
      createRootRemoteDbItem({
        children: [
          createRemoteSystemDefinedListDbItem(),
          createRemoteOwnerDbItem(),
          createRemoteUserDefinedListDbItem(),
        ],
      }),
      createRemoteSystemDefinedListDbItem({
        listName: "top_10",
        listDisplayName: "Top 10 repositories",
        listDescription: "Top 10 repositories of a language",
        selected: true,
      }),
    ];

    expect(getSelectedDbItem(dbItems)).toEqual({
      kind: DbItemKind.RemoteSystemDefinedList,
      listName: "top_10",
      listDisplayName: "Top 10 repositories",
      listDescription: "Top 10 repositories of a language",
      selected: true,
    });
  });

  it("should handle empty db item lists", () => {
    const dbItems: DbItem[] = [
      createRootRemoteDbItem({
        children: [
          createRemoteSystemDefinedListDbItem(),
          createRemoteOwnerDbItem(),
          createRemoteUserDefinedListDbItem({
            repos: [],
            selected: true,
            listName: "list84",
          }),
        ],
      }),
    ];
    expect(getSelectedDbItem(dbItems)).toEqual({
      expanded: false,
      kind: DbItemKind.RemoteUserDefinedList,
      listName: "list84",
      repos: [],
      selected: true,
    });
  });
});
