import { DatabaseItem } from "./database-item";

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
}
