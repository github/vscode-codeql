import { parseLibraryFilename } from "../../../src/model-editor/library";

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
    {
      filename: "org.eclipse.sisu.plexus-0.9.0.M2.jar",
      name: "org.eclipse.sisu.plexus",
      version: "0.9.0.M2",
    },
    {
      filename: "org.eclipse.sisu.inject-0.9.0.M2.jar",
      name: "org.eclipse.sisu.inject",
      version: "0.9.0.M2",
    },
    {
      filename: "slf4j-api-1.7.36.jar",
      name: "slf4j-api",
      version: "1.7.36",
    },
    {
      filename: "guava-30.1.1-jre.jar",
      name: "guava",
      version: "30.1.1-jre",
    },
    {
      filename: "caliper-1.0-beta-3.jar",
      name: "caliper",
      version: "1.0-beta-3",
    },
    {
      filename: "protobuf-java-4.0.0-rc-2.jar",
      name: "protobuf-java",
      version: "4.0.0-rc-2",
    },
    {
      filename: "jetty-util-9.4.51.v20230217.jar",
      name: "jetty-util",
      version: "9.4.51.v20230217",
    },
    {
      filename: "jetty-servlet-9.4.51.v20230217.jar",
      name: "jetty-servlet",
      version: "9.4.51.v20230217",
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
