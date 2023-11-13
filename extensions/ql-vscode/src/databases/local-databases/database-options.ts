import { DatabaseSource } from "./database-source";

export interface DatabaseOptions {
  displayName?: string;
  dateAdded?: number | undefined;
  language?: string;
  source?: DatabaseSource;
}

export interface FullDatabaseOptions extends DatabaseOptions {
  dateAdded: number | undefined;
  language: string | undefined;
  source: DatabaseSource | undefined;
}
