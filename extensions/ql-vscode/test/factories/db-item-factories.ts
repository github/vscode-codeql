import {
  DbItemKind,
  RemoteUserDefinedListDbItem,
  RootRemoteDbItem,
} from "../../src/databases/db-item";

export function createRootRemoteDbItem(): RootRemoteDbItem {
  return {
    kind: DbItemKind.RootRemote,
    children: [],
    expanded: false,
  };
}

export function createRemoteUserDefinedListDbItem({
  name = "list1",
}: {
  name: string;
}): RemoteUserDefinedListDbItem {
  return {
    kind: DbItemKind.RemoteUserDefinedList,
    selected: false,
    expanded: false,
    listName: name,
    repos: [
      {
        kind: DbItemKind.RemoteRepo,
        selected: false,
        repoFullName: "repo1",
        parentListName: name,
      },
    ],
  };
}
