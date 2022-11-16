import { QueryStatus } from "../query-status";
import { RemoteQuery } from "./remote-query";

/**
 * Information about a remote query.
 */
export interface RemoteQueryHistoryItem {
  readonly t: "remote";
  failureReason?: string;
  resultCount?: number;
  status: QueryStatus;
  completed: boolean;
  readonly queryId: string;
  remoteQuery: RemoteQuery;
  userSpecifiedLabel?: string;
}
