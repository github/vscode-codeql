import { QueryStatus } from '../query-status';
import { RemoteQuery } from './remote-query';

/**
 * Information about a remote query.
 */
export interface RemoteQueryHistoryItem {
  readonly t: 'remote';
  failureReason?: string;
  status: QueryStatus;
  completed: boolean;
  readonly queryId: string,
  label: string, // TODO, the query label should have interpolation like local queries
  remoteQuery: RemoteQuery,
}
