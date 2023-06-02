import { DatabasePersistenceManager } from "../local-databases/database-persistence-manager";
import { DbConfigStore } from "./db-config-store";
import { DisposableObject } from "../../pure/disposable-object";
import { DatabaseItem } from "../local-databases";
import { DbItemKind, LocalDatabaseDbItem } from "../db-item";
import { SelectedDbItemKind } from "./db-config";

function toDbItem(databaseItem: DatabaseItem): LocalDatabaseDbItem {
  return {
    kind: DbItemKind.LocalDatabase,
    databaseName: databaseItem.name,
    dateAdded: databaseItem.dateAdded ?? 0,
    language: databaseItem.language,
    storagePath: databaseItem.databaseUri.toString(true),
    selected: false,
  };
}

export class DbConfigPersistenceManager
  extends DisposableObject
  implements DatabasePersistenceManager
{
  public constructor(private dbConfigStore: DbConfigStore) {
    super();
  }

  async addDatabaseItem(databaseItem: DatabaseItem): Promise<void> {
    await this.dbConfigStore.addLocalDb(toDbItem(databaseItem));
  }

  async removeDatabaseItem(item: DatabaseItem): Promise<void> {
    await this.dbConfigStore.removeDbItem(toDbItem(item));
  }

  async renameDatabaseItem(item: DatabaseItem, newName: string): Promise<void> {
    await this.dbConfigStore.renameLocalDb(toDbItem(item), newName);
  }

  async setCurrentDatabaseItem(item: DatabaseItem | undefined): Promise<void> {
    if (!item) {
      // TODO: handle this case
      return;
    }

    await this.dbConfigStore.setSelectedDbItem({
      kind: SelectedDbItemKind.LocalDatabase,
      databaseName: item.name,
    });
  }
}
