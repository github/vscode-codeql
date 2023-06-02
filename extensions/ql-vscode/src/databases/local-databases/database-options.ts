export interface DatabaseOptions {
  displayName?: string;
  ignoreSourceArchive?: boolean;
  dateAdded?: number | undefined;
  language?: string;
}

export interface FullDatabaseOptions extends DatabaseOptions {
  ignoreSourceArchive: boolean;
  dateAdded: number | undefined;
  language: string | undefined;
}
