import * as path from "path";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";

import { sarifParser } from "../../sarif-parser";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("sarif parser", function () {
  const sarifDir = path.join(__dirname, "data/sarif");
  it("should parse a valid SARIF file", async () => {
    const result = await sarifParser(path.join(sarifDir, "validSarif.sarif"));
    expect(result.version).to.exist;
    expect(result.runs).to.exist;
    expect(result.runs[0].tool).to.exist;
    expect(result.runs[0].tool.driver).to.exist;
    expect(result.runs.length).to.be.at.least(1);
  });

  it("should return an empty array if there are no results", async () => {
    const result = await sarifParser(
      path.join(sarifDir, "emptyResultsSarif.sarif"),
    );
    expect(result.runs[0].results).to.be.empty;
  });
});
