import { join } from "path";
import { dirSync } from "tmp-promise";
import type { DirResult } from "tmp";
import { outputFile } from "fs-extra";
import { dump } from "js-yaml";
import { QueryLanguage } from "../../../src/common/query-language";
import { getQlPackLanguage } from "../../../src/common/qlpack-language";

describe("getQlPackLanguage", () => {
  let tmpDir: DirResult;
  let qlpackPath: string;

  beforeEach(() => {
    tmpDir = dirSync({
      prefix: "queries_",
      keep: false,
      unsafeCleanup: true,
    });

    qlpackPath = join(tmpDir.name, "qlpack.yml");
  });

  afterEach(() => {
    tmpDir.removeCallback();
  });

  it.each(Object.values(QueryLanguage))(
    "should find a single language %s",
    async (language) => {
      await writeYAML(qlpackPath, {
        name: "test",
        dependencies: {
          [`codeql/${language}-all`]: "^0.7.0",
          "my-custom-pack/test": "${workspace}",
        },
      });

      const result = await getQlPackLanguage(qlpackPath);
      expect(result).toEqual(language);
    },
  );

  it("should find nothing when there is no dependencies key", async () => {
    await writeYAML(qlpackPath, {
      name: "test",
    });

    const result = await getQlPackLanguage(qlpackPath);
    expect(result).toEqual(undefined);
  });

  it("should find nothing when the dependencies are empty", async () => {
    await writeYAML(qlpackPath, {
      name: "test",
      dependencies: {},
    });

    const result = await getQlPackLanguage(qlpackPath);
    expect(result).toEqual(undefined);
  });

  it("should throw when dependencies is a scalar", async () => {
    await writeYAML(qlpackPath, {
      name: "test",
      dependencies: "codeql/java-all",
    });

    await expect(getQlPackLanguage(qlpackPath)).rejects.toBeDefined();
  });

  it("should throw when dependencies is an array", async () => {
    await writeYAML(qlpackPath, {
      name: "test",
      dependencies: ["codeql/java-all"],
    });

    await expect(getQlPackLanguage(qlpackPath)).rejects.toBeDefined();
  });

  it("should find nothing when there are no matching dependencies", async () => {
    await writeYAML(qlpackPath, {
      name: "test",
      dependencies: {
        "codeql/java-queries": "*",
        "github/my-test-query-pack": "*",
      },
    });

    const result = await getQlPackLanguage(qlpackPath);
    expect(result).toEqual(undefined);
  });

  it("should find nothing when there are multiple matching dependencies", async () => {
    await writeYAML(qlpackPath, {
      name: "test",
      dependencies: {
        "codeql/java-all": "*",
        "codeql/csharp-all": "*",
      },
    });

    const result = await getQlPackLanguage(qlpackPath);
    expect(result).toEqual(undefined);
  });

  it("should throw when the file does not exist", async () => {
    await expect(getQlPackLanguage(qlpackPath)).rejects.toBeDefined();
  });

  it("should throw when reading a directory", async () => {
    await expect(getQlPackLanguage(tmpDir.name)).rejects.toBeDefined();
  });

  it("should throw when the file is invalid YAML", async () => {
    await outputFile(qlpackPath, `name: test\n  foo: bar`);

    await expect(getQlPackLanguage(tmpDir.name)).rejects.toBeDefined();
  });
});

async function writeYAML(path: string, yaml: unknown): Promise<void> {
  await outputFile(path, dump(yaml), "utf-8");
}
