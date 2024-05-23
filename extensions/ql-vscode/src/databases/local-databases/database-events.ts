import type { DatabaseItem } from "./database-item";

export enum DatabaseEventKind {
  Add = "Add",
  Remove = "Remove",

  // Fired when databases are refreshed from persisted state
  Refresh = "Refresh",

  // Fired when the current database changes
  Change = "Change",

  Rename = "Rename",
}

export interface DatabaseChangedEvent {
  kind: DatabaseEventKind;
  item: DatabaseItem | undefined;
  // If true, event handlers should consider the database manager
  // to have been fully refreshed. Any state managed by the
  // event handler should be fully refreshed as well.
  fullRefresh: boolean;
}
