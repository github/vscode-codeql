import { join } from "path";

import { parseViewerData } from "../../../src/log-insights/log-summary-parser";

describe("Evaluator log summary tests", () => {
  describe("for a valid summary text", () => {
    it("should return only valid EvalLogData objects", async () => {
      const validSummaryPath = join(
        __dirname,
        "../data/evaluator-log-summaries/valid-summary.jsonl",
      );
      const logDataItems = await parseViewerData(validSummaryPath);
      expect(logDataItems).toBeDefined();
      expect(logDataItems.length).toBe(3);
      for (const item of logDataItems) {
        expect(item.predicateName).not.toHaveLength(0);
        expect(item.millis).toEqual(expect.any(Number));
        expect(item.resultSize).toEqual(expect.any(Number));
        expect(item.ra).toBeDefined();
        expect(Object.keys(item.ra)).not.toHaveLength(0);
        for (const [pipeline, steps] of Object.entries(item.ra)) {
          expect(Object.keys(pipeline)).not.toHaveLength(0);
          expect(steps).toBeDefined();
          expect(steps.length).toBeGreaterThan(0);
        }
      }
    });

    it("should not parse a summary header object", async () => {
      const invalidHeaderPath = join(
        __dirname,
        "../data/evaluator-log-summaries/invalid-header.jsonl",
      );
      const logDataItems = await parseViewerData(invalidHeaderPath);
      expect(logDataItems.length).toBe(0);
    });

    it("should not parse a log event missing RA or millis fields", async () => {
      const invalidSummaryPath = join(
        __dirname,
        "../data/evaluator-log-summaries/invalid-summary.jsonl",
      );
      const logDataItems = await parseViewerData(invalidSummaryPath);
      expect(logDataItems.length).toBe(0);
    });
  });
});
