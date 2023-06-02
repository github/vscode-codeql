import { DatabaseItem } from "./database-item";

export interface DatabasePersistenceManager {
  setCurrentDatabaseItem(item: DatabaseItem | undefined): Promise<void>;
  addDatabaseItem(databaseItem: DatabaseItem): Promise<void>;
  renameDatabaseItem(item: DatabaseItem, newName: string): Promise<void>;
  removeDatabaseItem(item: DatabaseItem): Promise<void>;
}
