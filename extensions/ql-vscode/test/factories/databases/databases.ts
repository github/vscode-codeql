import { join } from "path";
import { Uri } from "vscode";
import type {
  DatabaseContents,
  FullDatabaseOptions,
} from "../../../src/databases/local-databases";
import { DatabaseItemImpl } from "../../../src/databases/local-databases";
import type { DirResult } from "tmp";

export function mockDbOptions(): FullDatabaseOptions {
  return {
    dateAdded: 123,
    language: "",
    origin: {
      type: "folder",
    },
    extensionManagedLocation: undefined,
  };
}

export function createMockDB(
  dir: DirResult | string,
  dbOptions = mockDbOptions(),
  // source archive location must be a real(-ish) location since
  // tests will add this to the workspace location
  sourceArchiveUri?: Uri,
  databaseUri?: Uri,
): DatabaseItemImpl {
  sourceArchiveUri = sourceArchiveUri || sourceLocationUri(dir);
  databaseUri = databaseUri || dbLocationUri(dir);

  return new DatabaseItemImpl(
    databaseUri,
    {
      sourceArchiveUri,
      datasetUri: databaseUri,
    } as DatabaseContents,
    dbOptions,
  );
}

export function sourceLocationUri(dir: DirResult | string) {
  if (typeof dir === "string") {
    return Uri.file(join(dir, "src.zip"));
  }

  return Uri.file(join(dir.name, "src.zip"));
}

export function dbLocationUri(dir: DirResult | string) {
  if (typeof dir === "string") {
    return Uri.file(join(dir, "db"));
  }

  return Uri.file(join(dir.name, "db"));
}
