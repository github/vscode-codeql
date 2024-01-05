import { EvalLogTreeBuilder } from "../../../../src/query-evaluation-logging";
import type { EvalLogData } from "../../../../src/log-insights/log-summary-parser";

describe("EvalLogTreeBuilder", () => {
  it("should build the log tree roots", async () => {
    const evalLogDataItems: EvalLogData[] = [
      {
        predicateName: "quick_eval#query#ffffffff",
        millis: 1,
        resultSize: 596,
        ra: {
          pipeline: ["{1} r1", "{2} r2", "return r2"],
        },
      },
    ];

    const expectedRoots = [
      {
        label: "test-query.ql",
        children: undefined,
      },
    ];

    const expectedPredicate = [
      {
        label: "quick_eval#query#ffffffff (596 tuples, 1 ms)",
        children: undefined,
        parent: undefined,
      },
    ];

    const expectedRA = [
      {
        label: "Pipeline: pipeline",
        children: undefined,
        parent: undefined,
      },
    ];

    const expectedPipelineSteps = [
      {
        label: "{1} r1",
        children: [],
        parent: undefined,
      },
      {
        label: "{2} r2",
        children: [],
        parent: undefined,
      },
      {
        label: "return r2",
        children: [],
        parent: undefined,
      },
    ];

    const builder = new EvalLogTreeBuilder("test-query.ql", evalLogDataItems);
    const roots = await builder.getRoots();

    // Force children, parent to be undefined for ease of testing.
    expect(roots.map((r) => ({ ...r, children: undefined }))).toEqual(
      expectedRoots,
    );

    expect(
      roots[0].children.map((pred) => ({
        ...pred,
        children: undefined,
        parent: undefined,
      })),
    ).toEqual(expectedPredicate);

    expect(
      roots[0].children[0].children.map((ra) => ({
        ...ra,
        children: undefined,
        parent: undefined,
      })),
    ).toEqual(expectedRA);

    // Pipeline steps' children should be empty so do not force undefined children here.
    expect(
      roots[0].children[0].children[0].children.map((step) => ({
        ...step,
        parent: undefined,
      })),
    ).toEqual(expectedPipelineSteps);
  });

  it("should build the tree with descriptive message when no data exists", async () => {
    // Force children, parent to be undefined for ease of testing.
    const expectedRoots = [
      {
        label: "test-query-cached.ql",
        children: undefined,
      },
    ];
    const expectedNoPredicates = [
      {
        label: "No predicates evaluated in this query run.",
        children: [], // Should be empty so do not force empty here.
        parent: undefined,
      },
    ];
    const builder = new EvalLogTreeBuilder("test-query-cached.ql", []);
    const roots = await builder.getRoots();

    expect(roots.map((r) => ({ ...r, children: undefined }))).toEqual(
      expectedRoots,
    );

    expect(
      roots[0].children.map((noPreds) => ({ ...noPreds, parent: undefined })),
    ).toEqual(expectedNoPredicates);
  });
});
