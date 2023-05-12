import { join } from "path";
// import tmp from "tmp";
// import * as fs from "fs";

import {
  decodePositionFromString,
  isNonComputeRow,
  jsonLogToArrayOfJSON,
  jsonLogToPerformanceLogEntries,
  jsonLogRowToPerformanceLogEntry,
  indexPerformanceLogEntries,
  pruneMissingDependencies,
} from "../../../src/performance-editor/performance-editor-log-reader";

describe("performance editor view model tests", () => {
  const logSummary = join(
    __dirname,
    "../data/performance-editor/example-log-summary.jsonl",
  );

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
    const ras = jsonLogToPerformanceLogEntries(rows);
    expect(ras.length).toBe(335);
  });

  it("should create a valid index", () => {
    const rows = jsonLogToArrayOfJSON(logSummary);
    const ras = jsonLogToPerformanceLogEntries(rows);
    const idx = indexPerformanceLogEntries(ras);

    const s = new Set<string>();

    for (const ra of ras) {
      s.add(ra.raHash);
    }

    expect(idx.size).toBe(s.size);
  });

  it("should correctly prune dependencies", () => {
    const rows = jsonLogToArrayOfJSON(logSummary);
    const ras = jsonLogToPerformanceLogEntries(rows);
    const idx = indexPerformanceLogEntries(ras);

    // Note this is a `SENTINEL_EMPTY` node in the log.
    expect(idx.has("1fd97cs69091peoj31jgk2dl1p7")).toBe(false);

    let found = false;
    for (const a of ras) {
      a.dependencies.forEach((d) => {
        if (d.raHash === "1fd97cs69091peoj31jgk2dl1p7") {
          found = true;
        }
      });
    }
    expect(found).toBe(true);
    pruneMissingDependencies(ras, idx);

    for (const a of ras) {
      a.dependencies.forEach((d) => {
        expect(d.raHash).not.toBe("1fd97cs69091peoj31jgk2dl1p7");
      });
    }
  });

  it("should correctly decode deps", () => {
    const a = jsonLogRowToPerformanceLogEntry({
      raHash: "raHash2",
      completionTime: "",
      completionTimeUs: 0,
      evaluationStrategy: "",
      millis: 0,
      predicateName: "",
      dependencies: { obj4: "raHash4", obj5: "raHash5" },
      position: "/home/jls.file.file:1,2-3,4",
    });

    expect(a.dependencies.length).toBe(2);
    expect(a.dependencies[0].predicateName).toBe("obj4");
    expect(a.dependencies[0].raHash).toBe("raHash4");
    expect(a.dependencies[1].predicateName).toBe("obj5");
    expect(a.dependencies[1].raHash).toBe("raHash5");

    const b = jsonLogRowToPerformanceLogEntry({
      raHash: "raHash2",
      completionTime: "",
      completionTimeUs: 0,
      evaluationStrategy: "",
      millis: 0,
      predicateName: "",
      dependencies: {},
      position: "/home/jls.file.file:1,2-3,4",
    });

    expect(b.dependencies.length).toBe(0);

    const c = jsonLogRowToPerformanceLogEntry({
      raHash: "raHash2",
      completionTime: "",
      completionTimeUs: 0,
      evaluationStrategy: "",
      millis: 0,
      predicateName: "",
      position: "/home/jls.file.file:1,2-3,4",
    });

    expect(c.dependencies.length).toBe(0);
  });
});
