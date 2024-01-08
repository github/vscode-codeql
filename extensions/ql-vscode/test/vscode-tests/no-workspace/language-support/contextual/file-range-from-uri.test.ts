import { Uri, Range } from "vscode";

import type { DatabaseItem } from "../../../../../src/databases/local-databases";
import type {
  BqrsWholeFileLocation,
  BqrsLineColumnLocation,
} from "../../../../../src/common/bqrs-cli-types";
import { mockDatabaseItem } from "../../../utils/mocking.helpers";
import { fileRangeFromURI } from "../../../../../src/language-support";

describe("fileRangeFromURI", () => {
  it("should return undefined when value is not a file URI", () => {
    expect(
      fileRangeFromURI("hucairz", createMockDatabaseItem()),
    ).toBeUndefined();
  });

  it("should fail to find a location when not a file URI and a full 5 part location", () => {
    expect(
      fileRangeFromURI(
        {
          uri: "https://yahoo.com",
          startLine: 1,
          startColumn: 2,
          endLine: 3,
          endColumn: 4,
        } as BqrsLineColumnLocation,
        createMockDatabaseItem(),
      ),
    ).toBeUndefined();
  });

  it("should fail to find a location when there is a silly protocol", () => {
    expect(
      fileRangeFromURI(
        {
          uri: "filesilly://yahoo.com",
          startLine: 1,
          startColumn: 2,
          endLine: 3,
          endColumn: 4,
        } as BqrsLineColumnLocation,
        createMockDatabaseItem(),
      ),
    ).toBeUndefined();
  });

  it("should return undefined when value is an empty uri", () => {
    expect(
      fileRangeFromURI(
        {
          uri: "file:/",
          startLine: 1,
          startColumn: 2,
          endLine: 3,
          endColumn: 4,
        } as BqrsLineColumnLocation,
        createMockDatabaseItem(),
      ),
    ).toBeUndefined();
  });

  it("should return a range for a WholeFileLocation", () => {
    expect(
      fileRangeFromURI(
        {
          uri: "file:///hucairz",
        } as BqrsWholeFileLocation,
        createMockDatabaseItem(),
      ),
    ).toEqual({
      uri: Uri.parse("file:///hucairz", true),
      range: new Range(0, 0, 0, 0),
    });
  });

  it("should return a range for a LineColumnLocation", () => {
    expect(
      fileRangeFromURI(
        {
          uri: "file:///hucairz",
          startLine: 1,
          startColumn: 2,
          endLine: 3,
          endColumn: 4,
        } as BqrsLineColumnLocation,
        createMockDatabaseItem(),
      ),
    ).toEqual({
      uri: Uri.parse("file:///hucairz", true),
      range: new Range(0, 1, 2, 4),
    });
  });

  function createMockDatabaseItem(): DatabaseItem {
    return mockDatabaseItem({
      resolveSourceFile: (file: string) => Uri.parse(file),
    });
  }
});
