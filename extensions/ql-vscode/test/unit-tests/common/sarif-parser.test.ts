import { join } from "path";

import { sarifParser } from "../../../src/common/sarif-parser";

describe("sarif parser", () => {
  const sarifDir = join(__dirname, "../../data/sarif");
  it("should parse a valid SARIF file", async () => {
    const result = await sarifParser(join(sarifDir, "validSarif.sarif"));
    expect(result.version).toBeDefined();
    expect(result.runs).toBeDefined();
    expect(result.runs[0].tool).toBeDefined();
    expect(result.runs[0].tool.driver).toBeDefined();
    expect(result.runs.length).toBeGreaterThanOrEqual(1);
  });

  it("should return an empty array if there are no results", async () => {
    const result = await sarifParser(join(sarifDir, "emptyResultsSarif.sarif"));
    expect(result.runs[0].results).toHaveLength(0);
  });
});
