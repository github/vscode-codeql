
// TODO This is a stub and will be filled implemented in later PRs.

import { QueryStatus } from '../query-status';

/**
 * Information about a remote query.
 */
export interface RemoteQueryInfo {
  readonly t: 'remote';
  label: string;
  failureReason: string | undefined;
  status: QueryStatus;
  isCompleted(): boolean;
}
