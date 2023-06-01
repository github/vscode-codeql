export interface DatabaseOptions {
  displayName?: string;
  dateAdded?: number | undefined;
  language?: string;
}

export interface FullDatabaseOptions extends DatabaseOptions {
  dateAdded: number | undefined;
  language: string | undefined;
}
