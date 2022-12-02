import { DbItem, DbItemKind } from "./db-item";

export function getSelectedDbItem(dbItems: DbItem[]): DbItem | undefined {
  for (const dbItem of dbItems) {
    if (
      dbItem.kind === DbItemKind.RootRemote ||
      dbItem.kind === DbItemKind.RootLocal
    ) {
      for (const child of dbItem.children) {
        switch (child.kind) {
          case DbItemKind.LocalList:
            if (child.selected) {
              return child;
            }
            for (const database of child.databases) {
              if (database.selected) {
                return database;
              }
            }
            break;
          case DbItemKind.RemoteUserDefinedList:
            if (child.selected) {
              return child;
            }
            for (const repo of child.repos) {
              if (repo.selected) {
                return repo;
              }
            }
            break;
          default:
            if (child.selected) {
              return child;
            }
        }
      }
    }
  }
  return undefined;
}
