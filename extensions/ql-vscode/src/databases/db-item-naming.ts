import { DbItem, DbItemKind } from "./db-item";

export function getDbItemName(dbItem: DbItem): string | undefined {
  switch (dbItem.kind) {
    case DbItemKind.RootLocal:
    case DbItemKind.RootRemote:
      return undefined;
    case DbItemKind.LocalList:
    case DbItemKind.VariantAnalysisUserDefinedList:
    case DbItemKind.RemoteSystemDefinedList:
      return dbItem.listName;
    case DbItemKind.RemoteOwner:
      return dbItem.ownerName;
    case DbItemKind.LocalDatabase:
      return dbItem.databaseName;
    case DbItemKind.RemoteRepo:
      return dbItem.repoFullName;
  }
}
