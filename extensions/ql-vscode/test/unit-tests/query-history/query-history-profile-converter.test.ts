import { join } from "path";
import tmp from "tmp";
import * as fs from "fs";

import {
  RAHashable,
  convertJSONSummaryEvaluatorLog,
  decodePositionFromString,
  getDeepestExecutionRoot,
  getExecutionBounds,
  getExecutionDepth,
  getExecutionRoots,
  getInDependencyOrder,
  getIncomingEdges,
  indexRaElements,
  isNonComputeRow,
  jsonLogToArrayOfJSON,
  jsonLogToRALog,
  pruneNodesUnreachableFromRoot,
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
      isNonComputeRow({
        completionTime: "foo",
        predicateName: "bar",
        position: "",
      }),
    ).toBe(false);
    expect(isNonComputeRow({ predicateName: "bar" })).toBe(true);
    expect(isNonComputeRow({ completionTime: "foo" })).toBe(true);
    expect(isNonComputeRow({})).toBe(true);
  });

  it("should read the right number of rows", () => {
    // filtering on
    let rows = jsonLogToArrayOfJSON(logSummary);
    expect(rows.length).toBe(336);

    // filtering off
    rows = jsonLogToArrayOfJSON(logSummary, false);
    expect(rows.length).toBe(418);
  });

  it("should result in the right number of computational rows", () => {
    const rows = jsonLogToArrayOfJSON(logSummary);

    const ras = jsonLogToRALog(rows);

    expect(ras.length).toBe(335);
  });

  it("should properly decode position data", () => {
    const p1 = decodePositionFromString("/home/jls.file.file:1,2-3,4");
    const p2 = decodePositionFromString("C:\\a-path\\jls.file.file:1,2-3,4");

    expect(p1.startLine).toEqual(1);
    expect(p1.endLine).toEqual(3);
    expect(p1.startColumn).toEqual(2);
    expect(p1.endColumn).toEqual(4);

    expect(p2.startLine).toEqual(1);
    expect(p2.endLine).toEqual(3);
    expect(p2.startColumn).toEqual(2);
    expect(p2.endColumn).toEqual(4);
  });

  it("should result compute the right bounds", () => {
    const rows = jsonLogToArrayOfJSON(logSummary);

    const ras = jsonLogToRALog(rows);

    expect(getExecutionBounds(ras).min).toBeLessThan(
      getExecutionBounds(ras).max,
    );
    expect(getExecutionBounds(ras).max).toBe(1660167066709000);
    expect(getExecutionBounds(ras).min).toBe(1660166907957000);
  });

  it("update execution profile", () => {
    // Note
    // --------------------------------------------------------
    // To update the execution profile uncomment the lines below.
    // Make sure to comment them back out before committing.
    // const outFile = convertJSONSummaryEvaluatorLog(
    //   logSummary,
    //   tmp.fileSync().name,
    // );
    // fs.writeFileSync(
    //   exampleProfile,
    //   JSON.stringify(JSON.parse(fs.readFileSync(outFile, "utf8")), null, 2),
    // );
  });

  it("should compute the right execution depth", () => {
    const raRows: RAHashable[] = [
      {
        raHash: "raHash1",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj1: "raHash2" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash2",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj4: "raHash4", obj5: "raHash5" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash4",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj5: "raHash5" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash11",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj1: "raHash4" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash111",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj1: "raHash2" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
    ];

    const index = indexRaElements(raRows);
    const roots = getExecutionRoots(raRows);

    expect(roots.length).toBe(3);
    expect(roots[0].raHash).toBe("raHash1");
    expect(getExecutionDepth(roots[0], index)).toBe(2);
    expect(roots[1].raHash).toBe("raHash11");
    expect(getExecutionDepth(roots[1], index)).toBe(1);
    expect(roots[2].raHash).toBe("raHash111");
    expect(getExecutionDepth(roots[2], index)).toBe(2);
  });

  it("should prune infeasible execution paths", () => {
    const raRows: RAHashable[] = [
      {
        raHash: "raHash1",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj1: "raHash2" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash2",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj4: "raHash4", obj5: "raHash5" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash4",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj5: "raHash5" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash5",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: {},
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash11",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj1: "raHash4" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
    ];

    const deps = getInDependencyOrder(raRows);
    const db = indexRaElements(raRows);
    const deepest = getDeepestExecutionRoot(raRows, db)!;

    expect(deps[0].raHash).toBe("raHash5");
    expect(deps[1].raHash).toBe("raHash4");
    expect(deps[2].raHash).toBe("raHash2");
    expect(deps[3].raHash).toBe("raHash11");
    expect(deps[4].raHash).toBe("raHash1");

    const updatedDeps = pruneNodesUnreachableFromRoot(
      deps,
      db,
      deepest?.raHash,
    );

    expect(updatedDeps[0].raHash).toBe("raHash5");
    expect(updatedDeps[1].raHash).toBe("raHash4");
    expect(updatedDeps[2].raHash).toBe("raHash2");
    expect(updatedDeps[4].raHash).toBe("raHash1");
  });
  it("should compute the right dependency order", () => {
    const raRows: RAHashable[] = [
      {
        raHash: "raHash1",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj1: "raHash2" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash2",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj4: "raHash4", obj5: "raHash5" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash4",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj5: "raHash5" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash5",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: {},
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash11",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj1: "raHash4" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
    ];

    const deps = getInDependencyOrder(raRows);
    expect(deps[0].raHash).toBe("raHash5");
    expect(deps[1].raHash).toBe("raHash4");
    expect(deps[2].raHash).toBe("raHash2");
    expect(deps[3].raHash).toBe("raHash11");
    expect(deps[4].raHash).toBe("raHash1");
  });

  it("should find all the incoming edges", () => {
    const raRows: RAHashable[] = [
      {
        raHash: "raHash1",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj1: "raHash2" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash2",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj4: "raHash4", obj5: "raHash5" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash4",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj5: "raHash5" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash11",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj1: "raHash4" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
    ];

    const edges = getIncomingEdges(raRows);
    expect(edges.size).toBe(3);
  });

  it("should find the deepest root", () => {
    const raRows: RAHashable[] = [
      {
        raHash: "raHash1",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj1: "raHash2" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash2",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj4: "raHash4", obj5: "raHash5" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash4",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj5: "raHash5" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash11",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj1: "raHash4" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
    ];

    const index = indexRaElements(raRows);
    const roots = getExecutionRoots(raRows);

    expect(roots.length).toBe(2);
    expect(roots[0].raHash).toBe("raHash1");
    expect(roots[1].raHash).toBe("raHash11");

    const deepestRoot = getDeepestExecutionRoot(roots, index);

    expect(deepestRoot).toBeDefined();
    expect(deepestRoot!.raHash).toEqual("raHash1");
  });

  it("should get valid execution roots", () => {
    const raRows: RAHashable[] = [
      {
        raHash: "raHash1",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj1: "raHash2" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash2",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj2: "raHash4", obj3: "raHash2" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash11",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj1: "raHash2" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
    ];

    const roots = getExecutionRoots(raRows);

    expect(roots.length).toBe(2);
    expect(["raHash11", "raHash1"]).toContain(roots[0].raHash);
    expect(["raHash11", "raHash1"]).toContain(roots[1].raHash);
    expect(roots[0].raHash).not.toEqual(roots[1].raHash);
  });

  it("should create a valid profile", () => {
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

  it("should prune dependencies that don't exist", () => {
    const raHashes: RAHashable[] = [
      {
        raHash: "raHash1",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj1: "raHash2" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash2",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj2: "raHash4", obj3: "raHash2" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash2",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        dependencies: { obj4: "raHash4", obj5: "raHash5" },
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
    ];

    const raHashIndex = indexRaElements(raHashes);

    pruneRADependencies(raHashes, raHashIndex);

    expect(raHashes[0].dependencies).toEqual({ obj1: "raHash2" });
    expect(raHashes[1].dependencies).toEqual({ obj3: "raHash2" });
    expect(raHashes[2].dependencies).toEqual({});
  });

  it("should make sure indexes are sequential for non-identical objects", () => {
    const raHashes: RAHashable[] = [
      {
        raHash: "raHash1",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash2",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
    ];

    const raHashIndex = indexRaElements(raHashes);
    expect(raHashIndex.get("raHash1")?.index).toBe(1);
    expect(raHashIndex.get("raHash2")?.index).toBe(2);
    expect(raHashIndex.size).toEqual(2);
  });

  it("should make sure indexes shouldn't increment for identical objects", () => {
    const raHashes: RAHashable[] = [
      {
        raHash: "raHash",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
      {
        raHash: "raHash",
        completionTime: "",
        completionTimeUs: 0,
        evaluationStrategy: "",
        millis: 0,
        predicateName: "",
        position: {
          startLine: 0,
          endLine: 0,
          startColumn: 0,
          endColumn: 0,
          url: "",
        },
      },
    ];

    const raHashIndex = indexRaElements(raHashes);

    expect(raHashIndex.get("raHash")?.index).toBe(1);
    expect(raHashIndex.size).toEqual(1);
  });
});
