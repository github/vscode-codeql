import { parseLibraryFilename } from "../../../src/data-extensions-editor/library";

describe("parseLibraryFilename", () => {
  const testCases = [
    { filename: "sql2o-1.6.0.jar", name: "sql2o", version: "1.6.0" },
    {
      filename: "spring-boot-3.0.2.jar",
      name: "spring-boot",
      version: "3.0.2",
    },
    { filename: "rt.jar", name: "rt", version: undefined },
    { filename: "guava-15.0.jar", name: "guava", version: "15.0" },
    {
      filename: "embedded-db-junit-1.0.0.jar",
      name: "embedded-db-junit",
      version: "1.0.0",
    },
    {
      filename: "h2-1.3.160.jar",
      name: "h2",
      version: "1.3.160",
    },
    {
      filename: "joda-time-2.0.jar",
      name: "joda-time",
      version: "2.0",
    },
    {
      filename: "System.Runtime.dll",
      name: "System.Runtime",
      version: undefined,
    },
    {
      filename: "System.Linq.Expressions.dll",
      name: "System.Linq.Expressions",
      version: undefined,
    },
    {
      filename: "System.Diagnostics.Debug.dll",
      name: "System.Diagnostics.Debug",
      version: undefined,
    },
    {
      filename: "spring-boot-3.1.0-rc2.jar",
      name: "spring-boot",
      version: "3.1.0-rc2",
    },
  ];

  test.each(testCases)(
    "$filename is $name@$version",
    ({ filename, name, version }) => {
      expect(parseLibraryFilename(filename)).toEqual({
        name,
        version,
      });
    },
  );
});
