import { DatabaseOrigin } from "./database-origin";

export interface DatabaseOptions {
  displayName?: string;
  dateAdded?: number | undefined;
  language?: string;
  origin?: DatabaseOrigin;
}

export interface FullDatabaseOptions extends DatabaseOptions {
  dateAdded: number | undefined;
  language: string | undefined;
  origin: DatabaseOrigin | undefined;
}
