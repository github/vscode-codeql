import { DbConfigStore } from './db-config-store';
import { DbItem } from './db-item';
import { createLocalTree, createRemoteTree } from './db-tree-creator';

export class DbManager {
  constructor(
    private readonly dbConfigStore: DbConfigStore
  ) {
  }

  public getDbItems(): DbItem[] {
    const config = this.dbConfigStore.getConfig();

    return [
      createRemoteTree(config),
      createLocalTree()
    ];
  }
}
