import * as fs from 'fs-extra';
import * as path from 'path';

import { QueryStatus } from '../query-status';

/**
 * Information about a remote query.
 */
export class RemoteQueryHistoryItem {
  readonly t = 'remote';
  failureReason: string | undefined;
  status: QueryStatus;
  completed = false;

  constructor(
    public label: string, // TODO, the query label should have interpolation like local queries
    public readonly queryId: string,
    private readonly storagePath: string,
  ) {
    this.status = QueryStatus.InProgress;
  }

  isCompleted(): boolean {
    return this.completed;
  }
  async deleteQuery(): Promise<void> {
    await fs.remove(this.querySaveDir);
  }

  get querySaveDir(): string {
    return path.join(this.storagePath, this.queryId);
  }
}
