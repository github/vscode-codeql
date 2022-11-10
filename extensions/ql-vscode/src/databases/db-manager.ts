import { ValueResult } from '../common/value-result';
import { DbConfigStore } from './db-config-store';
import { DbItem } from './db-item';
import { createLocalTree, createRemoteTree } from './db-tree-creator';

export class DbManager {
  constructor(
    private readonly dbConfigStore: DbConfigStore
  ) {
  }

  public getDbItems(): ValueResult<DbItem[]> {
    const configResult = this.dbConfigStore.getConfig();
    if (configResult.isFailure) {
      return ValueResult.fail(configResult.errors);
    }

    return ValueResult.ok([
      createRemoteTree(configResult.value),
      createLocalTree()
    ]);
  }

  public getConfigPath(): string {
    return this.dbConfigStore.getConfigPath();
  }
}
