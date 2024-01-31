import { join } from "path";
import { findVariantAnalysisQlPackRoot } from "../../../src/variant-analysis/ql";
import "../../matchers/toEqualPath";

describe("findVariantAnalysisQlPackRoot", () => {
  const testDataDir = join(
    __dirname,
    "../../data/variant-analysis-query-packs",
  );

  const workspaceFolders = [
    getFullPath("workspace1"),
    getFullPath("workspace2"),
  ];

  function getFullPath(relativePath: string) {
    return join(testDataDir, relativePath);
  }

  it("should throw an error if no query files are provided", async () => {
    await expect(
      findVariantAnalysisQlPackRoot([], workspaceFolders),
    ).rejects.toThrow("No query files provided");
  });

  it("should return the pack root of a single query in a pack", async () => {
    const queryFiles = [getFullPath("workspace1/pack1/query1.ql")];

    const packRoot = await findVariantAnalysisQlPackRoot(
      queryFiles,
      workspaceFolders,
    );

    expect(packRoot).toEqualPath(getFullPath("workspace1/pack1"));
  });

  it("should return the pack root of a single query not in a pack", async () => {
    const queryFiles = [getFullPath("workspace1/query1.ql")];

    const packRoot = await findVariantAnalysisQlPackRoot(
      queryFiles,
      workspaceFolders,
    );

    expect(packRoot).toEqualPath(getFullPath("workspace1"));
  });

  it("should fail if single query not in a pack or workspace", async () => {
    const queryFiles = [getFullPath("workspace1/query1.ql")];
    const workspaceFolders = [getFullPath("workspace2")];

    await expect(
      findVariantAnalysisQlPackRoot(queryFiles, workspaceFolders),
    ).rejects.toThrow(
      "All queries must be within the workspace and within the same workspace root",
    );
  });

  it("should throw an error if some queries are in a pack and some are not", async () => {
    const queryFiles = [
      getFullPath("workspace1/pack1/query1.ql"),
      getFullPath("workspace1/query1.ql"),
    ];

    await expect(
      findVariantAnalysisQlPackRoot(queryFiles, workspaceFolders),
    ).rejects.toThrow("Some queries are in a pack and some aren't");
  });

  it("should throw an error if queries are in different packs", async () => {
    const queryFiles = [
      getFullPath("workspace1/pack1/query1.ql"),
      getFullPath("workspace1/pack2/query1.ql"),
    ];

    await expect(
      findVariantAnalysisQlPackRoot(queryFiles, workspaceFolders),
    ).rejects.toThrow("Some queries are in different packs");
  });

  it("should throw an error if query files are not in a pack and in different workspace folders", async () => {
    const queryFiles = [
      getFullPath("workspace1/query1.ql"),
      getFullPath("workspace2/query1.ql"),
    ];

    await expect(
      findVariantAnalysisQlPackRoot(queryFiles, workspaceFolders),
    ).rejects.toThrow(
      "All queries must be within the workspace and within the same workspace root",
    );
  });

  it("should throw an error if query files are not part of any workspace folder", async () => {
    const queryFiles = [
      getFullPath("workspace3/query1.ql"),
      getFullPath("workspace3/query2.ql"),
    ];

    await expect(
      findVariantAnalysisQlPackRoot(queryFiles, workspaceFolders),
    ).rejects.toThrow(
      "All queries must be within the workspace and within the same workspace root",
    );
  });

  it("should return the common parent directory if no queries are in a pack", async () => {
    const queryFiles = [
      getFullPath("workspace1/query1.ql"),
      getFullPath("workspace1/dir1/query1.ql"),
    ];

    const result = await findVariantAnalysisQlPackRoot(
      queryFiles,
      workspaceFolders,
    );

    expect(result).toEqualPath(getFullPath("workspace1"));
  });

  it("should return the pack root if all query files are in the same pack", async () => {
    const queryFiles = [
      getFullPath("workspace1/pack1/query1.ql"),
      getFullPath("workspace1/pack1/query2.ql"),
    ];

    const result = await findVariantAnalysisQlPackRoot(
      queryFiles,
      workspaceFolders,
    );

    expect(result).toEqualPath(getFullPath("workspace1/pack1"));
  });
});
