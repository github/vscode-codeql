import { Location, Position, Range, Uri } from "vscode";
import { mockDatabaseItem } from "../../../utils/mocking.helpers";
import { tryResolveLocation } from "../../../../../src/databases/local-databases/locations";

describe("tryResolveLocation", () => {
  const resolveSourceFile = jest.fn();

  const databaseItem = mockDatabaseItem({
    resolveSourceFile,
  });

  beforeEach(() => {
    resolveSourceFile.mockReturnValue(Uri.file("abc"));
  });

  it("should resolve a whole file location", () => {
    expect(
      tryResolveLocation(
        { type: "wholeFileLocation", uri: "file://hucairz:0:0:0:0" },
        databaseItem,
      ),
    ).toEqual(new Location(Uri.file("abc"), new Range(0, 0, 0, 0)));
  });

  it("should resolve a five-part location edge case", () => {
    expect(
      tryResolveLocation(
        {
          type: "lineColumnLocation",
          uri: "file://hucairz",
          startLine: 1,
          startColumn: 1,
          endLine: 1,
          endColumn: 1,
        },
        databaseItem,
      ),
    ).toEqual(new Location(Uri.file("abc"), new Range(0, 0, 0, 1)));
  });

  it("should resolve a five-part location", () => {
    expect(
      tryResolveLocation(
        {
          type: "lineColumnLocation",
          startColumn: 1,
          endColumn: 3,
          startLine: 4,
          endLine: 5,
          uri: "hucairz",
        },
        databaseItem,
      ),
    ).toEqual(
      new Location(
        Uri.file("abc"),
        new Range(new Position(4, 3), new Position(3, 0)),
      ),
    );
    expect(databaseItem.resolveSourceFile).toHaveBeenCalledTimes(1);
    expect(databaseItem.resolveSourceFile).toHaveBeenCalledWith("hucairz");
  });
});
