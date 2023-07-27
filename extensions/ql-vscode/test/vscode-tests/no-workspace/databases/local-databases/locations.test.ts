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
    expect(tryResolveLocation("file://hucairz:0:0:0:0", databaseItem)).toEqual(
      new Location(Uri.file("abc"), new Range(0, 0, 0, 0)),
    );
  });

  it("should resolve a five-part location edge case", () => {
    expect(tryResolveLocation("file://hucairz:1:1:1:1", databaseItem)).toEqual(
      new Location(Uri.file("abc"), new Range(0, 0, 0, 1)),
    );
  });

  it("should resolve a five-part location", () => {
    expect(
      tryResolveLocation(
        {
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

  it("should resolve a five-part location with an empty path", () => {
    expect(
      tryResolveLocation(
        {
          startColumn: 1,
          endColumn: 3,
          startLine: 4,
          endLine: 5,
          uri: "",
        },
        databaseItem,
      ),
    ).toBeUndefined();
  });

  it("should resolve a string location for whole file", () => {
    expect(tryResolveLocation("file://hucairz:0:0:0:0", databaseItem)).toEqual(
      new Location(Uri.file("abc"), new Range(0, 0, 0, 0)),
    );
    expect(databaseItem.resolveSourceFile).toHaveBeenCalledTimes(1);
    expect(databaseItem.resolveSourceFile).toHaveBeenCalledWith("hucairz");
  });

  it("should resolve a string location for five-part location", () => {
    expect(tryResolveLocation("file://hucairz:5:4:3:2", databaseItem)).toEqual(
      new Location(
        Uri.file("abc"),
        new Range(new Position(4, 3), new Position(2, 2)),
      ),
    );
    expect(databaseItem.resolveSourceFile).toHaveBeenCalledTimes(1);
    expect(databaseItem.resolveSourceFile).toHaveBeenCalledWith("hucairz");
  });

  it("should resolve a string location for invalid string", () => {
    expect(
      tryResolveLocation("file://hucairz:x:y:z:a", databaseItem),
    ).toBeUndefined();
  });
});
