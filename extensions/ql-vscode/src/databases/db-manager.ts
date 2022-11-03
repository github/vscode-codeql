import { logger } from '../logging';
import { DbConfigStore } from './db-config-store';
import { DbItem } from './db-item';

export class DbManager {
  constructor(
    private readonly dbConfigStore: DbConfigStore
  ) {
  }

  public loadDatabases(): void {
    const config = this.dbConfigStore.getConfig();
    void logger.log(`Loaded databases: ${JSON.stringify(config)}`);

    // This will be fleshed out in a future change.
  }

  public getDbItems(): DbItem[] {
    // This will be fleshed out in a future change.
    return [];
  }

  public getConfigPath(): string {
    return this.dbConfigStore.getConfigPath();
  }
}
