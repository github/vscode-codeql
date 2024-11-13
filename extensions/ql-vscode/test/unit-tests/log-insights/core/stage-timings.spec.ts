import { Internal } from "../../../../src/log-insights/core/log-processors/stage-timings";

describe("stage-timings", () => {
  describe("convert", () => {
    test("should be able to convert 1234", () => {
      expect(Internal.convert("1234")).toBe(BigInt(49360));
    });
    test("should be able convert 0", () => {
      expect(Internal.convert("0")).toBe(BigInt(0));
    });
  });

  describe("parseComputedExtensionalName", () => {
    test("Should parse predicate name without module", () => {
      const name = "Type::erase#1#ff#6144c3fd";
      expect(Internal.parseComputedExtensionalName(name)).toEqual({
        module: "Type",
        name: "erase",
      });
    });

    test("Should parse predicate with module", () => {
      const name = "DataFlowImplCommon::Cached::TFrontNil#ff#2411651e";
      expect(Internal.parseComputedExtensionalName(name)).toEqual({
        module: "DataFlowImplCommon::Cached",
        name: "TFrontNil",
      });
    });
  });
  describe("computeHashForCachedPredicateList", () => {
    test("Should be able to compute hash for empty list", () => {
      expect(Internal.computeHashForCachedPredicateList([])).toBe("0");
    });
  });
  describe("computeFirstAndLastMaps", () => {
    test("Should be able to compute first and last for COMPUTED_EXTENSIONAL event", () => {
      const event: any = {
        completionTime: "2022-09-29T08:44:48.497Z",
        raHash: "bb21441hqb08oopcnhve1165klb",
        predicateName: "DataFlowImplCommon#2411651e::Cached::TFrontNil#ff",
        appearsAs: {
          "DataFlowImplCommon#2411651e::Cached::TFrontNil#ff": {
            "/Users/some_user/semmle/code/ql/java/ql/src/Security/CWE/CWE-1204/StaticInitializationVector.ql":
              [25],
            "/Users/some_user/semmle/code/ql/java/ql/src/Security/CWE/CWE-730/PolynomialReDoS.ql":
              [25],
          },
        },
        queryCausingWork:
          "/Users/some_user/semmle/code/ql/java/ql/src/Security/CWE/CWE-730/PolynomialReDoS.ql",
        evaluationStrategy: "COMPUTED_EXTENSIONAL",
        millis: 0,
        resultSize: 396624,
      };
      const lastStageForQuery = new Map<string, number>();
      expect(
        Array.from(
          Internal.computeStagesAndLastMaps(
            event,
            lastStageForQuery,
          ).stagesForQuery.entries(),
        ),
      ).toEqual([
        [
          "/Users/some_user/semmle/code/ql/java/ql/src/Security/CWE/CWE-1204/StaticInitializationVector.ql",
          new Set([25]),
        ],
        [
          "/Users/some_user/semmle/code/ql/java/ql/src/Security/CWE/CWE-730/PolynomialReDoS.ql",
          new Set([25]),
        ],
      ]);
    });
  });
  describe("computeStageMapKey", () => {
    test("Should be able to compute stage name for stage with two cached predicates", () => {
      const bundleId = ""; // Not needed for this test
      const queryName =
        "/Users/some_user/code/ql/cpp/ql/src/Critical/NewFreeMismatch.ql";
      const stageNumber = 6;
      const stageInfo = {
        millis: 15288,
        lastRaHash: "b3abeaeka7btn0veuma7udqmqma",
        lastPredName: "Enclosing::exprEnclosingElement#1#ff#c50c5fbf",
        cachedPredicateList: [
          {
            raHash: "9bacf5jrupf8d584ecufguct3ka",
            predName: "Enclosing::stmtEnclosingElement#1#ff#c50c5fbf",
          },
          {
            raHash: "b3abeaeka7btn0veuma7udqmqma",
            predName: "Enclosing::exprEnclosingElement#1#ff#c50c5fbf",
          },
        ],
      };
      const lastStageForQuery = new Map<string, number>(); // Not needed for this test
      expect(
        Internal.computeStageMapEntry(
          bundleId,
          queryName,
          stageNumber,
          stageInfo,
          lastStageForQuery,
        ).toJSON(),
      ).toEqual({
        hash: "1yqiv33ze5sh72wkoaszrbmgs94",
        shortName: "Enclosing#2",
        millis: 15288,
      });
    });
  });
});
