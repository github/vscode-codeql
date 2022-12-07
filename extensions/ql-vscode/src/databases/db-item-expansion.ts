import { ExpandedDbItem, ExpandedDbItemKind } from "./config/db-config";
import { DbItem, DbItemKind } from "./db-item";

export function calculateNewExpandedState(
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
    default:
      throw Error(`Unknown db item kind ${dbItem.kind}`);
  }
}
