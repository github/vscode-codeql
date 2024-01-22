import { join } from "path";
import { dirSync } from "tmp-promise";
import type { DirResult } from "tmp";
import { writeFile } from "fs-extra";
import { getQlPackFilePath } from "../../../src/common/ql";

describe("getQlPackFilePath", () => {
  let tmpDir: DirResult;

  beforeEach(() => {
    tmpDir = dirSync({
      prefix: "queries_",
      keep: false,
      unsafeCleanup: true,
    });
  });

  afterEach(() => {
    tmpDir.removeCallback();
  });

  it("should find a qlpack.yml when it exists", async () => {
    await writeFile(join(tmpDir.name, "qlpack.yml"), "name: test");

    const result = await getQlPackFilePath(tmpDir.name);
    expect(result).toEqual(join(tmpDir.name, "qlpack.yml"));
  });

  it("should find a codeql-pack.yml when it exists", async () => {
    await writeFile(join(tmpDir.name, "codeql-pack.yml"), "name: test");

    const result = await getQlPackFilePath(tmpDir.name);
    expect(result).toEqual(join(tmpDir.name, "codeql-pack.yml"));
  });

  it("should find a qlpack.yml when both exist", async () => {
    await writeFile(join(tmpDir.name, "qlpack.yml"), "name: test");
    await writeFile(join(tmpDir.name, "codeql-pack.yml"), "name: test");

    const result = await getQlPackFilePath(tmpDir.name);
    expect(result).toEqual(join(tmpDir.name, "qlpack.yml"));
  });

  it("should find nothing when it doesn't exist", async () => {
    const result = await getQlPackFilePath(tmpDir.name);
    expect(result).toEqual(undefined);
  });
});
