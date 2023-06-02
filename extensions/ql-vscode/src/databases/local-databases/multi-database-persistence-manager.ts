import { DatabasePersistenceManager } from "./database-persistence-manager";
import { DisposableObject } from "../../pure/disposable-object";
import { DatabaseItem } from "./database-item";

export class MultiDatabasePersistenceManager
  extends DisposableObject
  implements DatabasePersistenceManager
{
  constructor(private readonly managers: DatabasePersistenceManager[]) {
    super();
    this.managers = managers;
  }

  async addDatabaseItem(databaseItem: DatabaseItem): Promise<void> {
    await Promise.all(
      this.managers.map((m) => m.addDatabaseItem(databaseItem)),
    );
  }

  async removeDatabaseItem(item: DatabaseItem): Promise<void> {
    await Promise.all(this.managers.map((m) => m.removeDatabaseItem(item)));
  }

  async renameDatabaseItem(item: DatabaseItem, newName: string): Promise<void> {
    await Promise.all(
      this.managers.map((m) => m.renameDatabaseItem(item, newName)),
    );
  }

  async setCurrentDatabaseItem(item: DatabaseItem | undefined): Promise<void> {
    await Promise.all(this.managers.map((m) => m.setCurrentDatabaseItem(item)));
  }
}
