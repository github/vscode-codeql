import type { DbItem } from "./db-item";
import { DbItemKind } from "./db-item";

export function getDbItemName(dbItem: DbItem): string | undefined {
  switch (dbItem.kind) {
    case DbItemKind.RootRemote:
      return undefined;
    case DbItemKind.RemoteUserDefinedList:
    case DbItemKind.RemoteSystemDefinedList:
      return dbItem.listName;
    case DbItemKind.RemoteOwner:
      return dbItem.ownerName;
    case DbItemKind.RemoteRepo:
      return dbItem.repoFullName;
  }
}
