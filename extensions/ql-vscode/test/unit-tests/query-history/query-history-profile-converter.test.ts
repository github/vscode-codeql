import { join } from "path";
import tmp from "tmp";
import * as fs from "fs";

import {
  RAHashable,
  convertJSONSummaryEvaluatorLog,
  getExecutionBounds,
  indexRaElements,
  isNonComputeRow,
  jsonLogToArrayOfJSON,
  jsonLogToRALog,
  pruneRADependencies,
} from "../../../src/query-history/query-history-profile-converter";

describe("query history profile converter", () => {
  const logSummary = join(
    __dirname,
    "../data/profile-converter/example-log-summary.jsonl",
  );
  const exampleProfile = join(
    __dirname,
    "../data/profile-converter/example-profile.cpuprofile",
  );

  it("should filter the right rows", () => {
    expect(
      isNonComputeRow({ completionTime: "foo", predicateName: "bar" }),
    ).toBe(false);
    expect(isNonComputeRow({ predicateName: "bar" })).toBe(true);
    expect(isNonComputeRow({ completionTime: "foo" })).toBe(true);
    expect(isNonComputeRow({})).toBe(true);
  });

  it("it should read the right number of rows", () => {
    // filtering on
    let rows = jsonLogToArrayOfJSON(logSummary);
    expect(rows.length).toBe(417);

    // filtering off
    rows = jsonLogToArrayOfJSON(logSummary, false);
    expect(rows.length).toBe(418);
  });

  it("it should result in the right number of computational rows", () => {
    const rows = jsonLogToArrayOfJSON(logSummary);

    const ras = jsonLogToRALog(rows);

    expect(ras.length).toBe(324);
  });

  it("it should result compute the right bounds", () => {
    const rows = jsonLogToArrayOfJSON(logSummary);

    const ras = jsonLogToRALog(rows);

    expect(getExecutionBounds(ras).min).toBeLessThan(
      getExecutionBounds(ras).max,
    );
    expect(getExecutionBounds(ras).max).toBe(1660167058484000);
    expect(getExecutionBounds(ras).min).toBe(1660166907957000);
  });

  it("it should create a valid profile", () => {
    // Note
    // --------------------------------------------------------
    // to update the expected output file comment out this line and then
    // set argument 2 of `convertJSONSummaryEvaluatorLog` to the
    // value `exampleProfile`.
    tmp.setGracefulCleanup();

    const outFile = convertJSONSummaryEvaluatorLog(
      logSummary,
      tmp.fileSync().name,
    );

    const expectedData = JSON.parse(fs.readFileSync(exampleProfile, "utf8"));
    const actualData = JSON.parse(fs.readFileSync(outFile, "utf8"));

    expect(JSON.stringify(expectedData, null, 2)).toEqual(
      JSON.stringify(actualData, null, 2),
    );
  });

  it("it should prune dependencies that don't exist", () => {
    const raHashes: RAHashable[] = [
      {
        raHash: "raHash1",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj1: "raHash2" },
      },
      {
        raHash: "raHash2",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj2: "raHash4", obj3: "raHash2" },
      },
      {
        raHash: "raHash2",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj4: "raHash4", obj5: "raHash5" },
      },
    ];

    const raHashIndex = indexRaElements(raHashes);

    pruneRADependencies(raHashes, raHashIndex);

    expect(raHashes[0].dependencies).toEqual({ obj1: "raHash2" });
    expect(raHashes[1].dependencies).toEqual({ obj3: "raHash2" });
    expect(raHashes[2].dependencies).toEqual({});
  });

  it("indexes should be sequential for non-identical objects", () => {
    const raHashes: RAHashable[] = [
      {
        raHash: "raHash1",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
      },
      {
        raHash: "raHash2",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
      },
    ];

    const raHashIndex = indexRaElements(raHashes);
    expect(raHashIndex.get("raHash1")?.index).toBe(1);
    expect(raHashIndex.get("raHash2")?.index).toBe(2);
    expect(raHashIndex.size).toEqual(2);
  });

  it("indexes shouldn't increment for identical objects", () => {
    const raHashes: RAHashable[] = [
      {
        raHash: "raHash",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
      },
      {
        raHash: "raHash",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
      },
    ];

    const raHashIndex = indexRaElements(raHashes);

    expect(raHashIndex.get("raHash")?.index).toBe(1);
    expect(raHashIndex.size).toEqual(1);
  });
});
