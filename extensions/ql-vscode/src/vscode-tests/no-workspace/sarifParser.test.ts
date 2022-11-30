import * as path from "path";

import { sarifParser } from "../../sarif-parser";

describe("sarif parser", () => {
  const sarifDir = path.join(__dirname, "data/sarif");
  it("should parse a valid SARIF file", async () => {
    const result = await sarifParser(path.join(sarifDir, "validSarif.sarif"));
    expect(result.version).toBeDefined();
    expect(result.runs).toBeDefined();
    expect(result.runs[0].tool).toBeDefined();
    expect(result.runs[0].tool.driver).toBeDefined();
    expect(result.runs.length).toBeGreaterThanOrEqual(1);
  });

  it("should return an empty array if there are no results", async () => {
    const result = await sarifParser(
      path.join(sarifDir, "emptyResultsSarif.sarif"),
    );
    expect(result.runs[0].results).toHaveLength(0);
  });
});
