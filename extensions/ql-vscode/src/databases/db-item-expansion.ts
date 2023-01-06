import { DbItem, DbItemKind, flattenDbItems } from "./db-item";

export type ExpandedDbItem =
  | RootLocalExpandedDbItem
  | LocalUserDefinedListExpandedDbItem
  | RootRemoteExpandedDbItem
  | RemoteUserDefinedListExpandedDbItem;

export enum ExpandedDbItemKind {
  RootLocal = "rootLocal",
  LocalUserDefinedList = "localUserDefinedList",
  RootRemote = "rootRemote",
  RemoteUserDefinedList = "remoteUserDefinedList",
}

export interface RootLocalExpandedDbItem {
  kind: ExpandedDbItemKind.RootLocal;
}

export interface LocalUserDefinedListExpandedDbItem {
  kind: ExpandedDbItemKind.LocalUserDefinedList;
  listName: string;
}

export interface RootRemoteExpandedDbItem {
  kind: ExpandedDbItemKind.RootRemote;
}

export interface RemoteUserDefinedListExpandedDbItem {
  kind: ExpandedDbItemKind.RemoteUserDefinedList;
  listName: string;
}

export function updateExpandedItem(
  currentExpandedItems: ExpandedDbItem[],
  dbItem: DbItem,
  itemExpanded: boolean,
): ExpandedDbItem[] {
  if (itemExpanded) {
    const expandedDbItem = mapDbItemToExpandedDbItem(dbItem);
    const expandedItems = [...currentExpandedItems];
    if (!expandedItems.some((i) => isDbItemEqualToExpandedDbItem(dbItem, i))) {
      expandedItems.push(expandedDbItem);
    }
    return expandedItems;
  } else {
    return currentExpandedItems.filter(
      (i) => !isDbItemEqualToExpandedDbItem(dbItem, i),
    );
  }
}

export function replaceExpandedItem(
  currentExpandedItems: ExpandedDbItem[],
  currentDbItem: DbItem,
  newDbItem: DbItem,
): ExpandedDbItem[] {
  const newExpandedItems: ExpandedDbItem[] = [];

  for (const item of currentExpandedItems) {
    if (isDbItemEqualToExpandedDbItem(currentDbItem, item)) {
      newExpandedItems.push(mapDbItemToExpandedDbItem(newDbItem));
    } else {
      newExpandedItems.push(item);
    }
  }

  return newExpandedItems;
}

export function cleanNonExistentExpandedItems(
  currentExpandedItems: ExpandedDbItem[],
  dbItems: DbItem[],
): ExpandedDbItem[] {
  const flattenedDbItems = flattenDbItems(dbItems);
  return currentExpandedItems.filter((i) =>
    flattenedDbItems.some((dbItem) => isDbItemEqualToExpandedDbItem(dbItem, i)),
  );
}

function mapDbItemToExpandedDbItem(dbItem: DbItem): ExpandedDbItem {
  switch (dbItem.kind) {
    case DbItemKind.RootLocal:
      return { kind: ExpandedDbItemKind.RootLocal };
    case DbItemKind.LocalList:
      return {
        kind: ExpandedDbItemKind.LocalUserDefinedList,
        listName: dbItem.listName,
      };
    case DbItemKind.RootRemote:
      return { kind: ExpandedDbItemKind.RootRemote };
    case DbItemKind.RemoteUserDefinedList:
      return {
        kind: ExpandedDbItemKind.RemoteUserDefinedList,
        listName: dbItem.listName,
      };
    default:
      throw Error(`Unknown db item kind ${dbItem.kind}`);
  }
}

function isDbItemEqualToExpandedDbItem(
  dbItem: DbItem,
  expandedDbItem: ExpandedDbItem,
) {
  switch (dbItem.kind) {
    case DbItemKind.RootLocal:
      return expandedDbItem.kind === ExpandedDbItemKind.RootLocal;
    case DbItemKind.LocalList:
      return (
        expandedDbItem.kind === ExpandedDbItemKind.LocalUserDefinedList &&
        expandedDbItem.listName === dbItem.listName
      );
    case DbItemKind.RootRemote:
      return expandedDbItem.kind === ExpandedDbItemKind.RootRemote;
    case DbItemKind.RemoteUserDefinedList:
      return (
        expandedDbItem.kind === ExpandedDbItemKind.RemoteUserDefinedList &&
        expandedDbItem.listName === dbItem.listName
      );
    case DbItemKind.LocalDatabase:
    case DbItemKind.RemoteSystemDefinedList:
    case DbItemKind.RemoteOwner:
    case DbItemKind.RemoteRepo:
      return false;
  }
}
