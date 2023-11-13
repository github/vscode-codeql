import { join } from "path";
import { Uri } from "vscode";
import {
  DatabaseContents,
  DatabaseItemImpl,
  FullDatabaseOptions,
} from "../../../src/databases/local-databases";
import { DirResult } from "tmp";

export function mockDbOptions(): FullDatabaseOptions {
  return {
    dateAdded: 123,
    language: "",
    source: {
      type: "folder",
    },
  };
}

export function createMockDB(
  dir: DirResult,
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

export function sourceLocationUri(dir: DirResult) {
  return Uri.file(join(dir.name, "src.zip"));
}

export function dbLocationUri(dir: DirResult) {
  return Uri.file(join(dir.name, "db"));
}
