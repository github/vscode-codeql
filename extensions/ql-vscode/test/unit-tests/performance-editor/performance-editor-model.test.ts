import { join } from "path";
import { DirectedGraph } from "graphology";
import { decodePositionFromString } from "../../../src/performance-editor/performance-editor-log-reader";
import { countConnectedComponents } from "graphology-components";
import { topologicalSort } from "graphology-dag/topological-sort";

import {
  PerformanceEntryData,
  PerformanceGraph,
} from "../../../src/performance-editor/performance-editor-model";

// import tmp from "tmp";
// import * as fs from "fs";

/**
 * Helper function for creating graphs.
 * @param id the id of the node
 * @param millis the time in ms.
 * @returns a PerformanceEntryData object
 */
function pdh(id: string, millis = 1): PerformanceEntryData {
  return {
    raHash: id,
    completionTime: "0",
    position: decodePositionFromString("/home/jls.file.file:1,2-3,4"),
    evaluationStrategy: "",
    millis,
    predicateName: id,
  };
}

describe("performance editor view model tests", () => {
  const logSummary = join(
    __dirname,
    "../data/performance-editor/example-log-summary.jsonl",
  );

  it("it should find the right roots", () => {
    const graph: DirectedGraph<PerformanceEntryData> =
      new DirectedGraph<PerformanceEntryData>();

    graph.addNode("a", pdh("a"));
    graph.addNode("b", pdh("b"));
    graph.addNode("c", pdh("c"));
    graph.addNode("d", pdh("d"));

    graph.addEdge("a", "b");
    graph.addEdge("b", "c");
    graph.addEdge("d", "c");

    const g = PerformanceGraph.fromGraph(graph);

    const roots = g.findExecutionRoots();

    expect(roots).toEqual(["a", "d"]);
  });

  it("it should find the deepest execution root", () => {
    const graph: DirectedGraph<PerformanceEntryData> =
      new DirectedGraph<PerformanceEntryData>();

    graph.addNode("a", pdh("a"));
    graph.addNode("b", pdh("b"));
    graph.addNode("c", pdh("c"));
    graph.addNode("d", pdh("d"));

    graph.addEdge("a", "b");
    graph.addEdge("b", "c");
    graph.addEdge("d", "c");

    const g = PerformanceGraph.fromGraph(graph);

    const root = g.getDeepestExecutionRoot(false);

    expect(root).toEqual("a");
  });

  it("it should find the deepest execution root (with selects)", () => {
    const graph: DirectedGraph<PerformanceEntryData> =
      new DirectedGraph<PerformanceEntryData>();

    graph.addNode("select a", pdh("select a"));
    graph.addNode("select b", pdh("select b"));
    graph.addNode("select c", pdh("select c"));
    graph.addNode("select d", pdh("select d"));

    graph.addEdge("select a", "select b");
    graph.addEdge("select b", "select c");
    graph.addEdge("select d", "select c");

    const g = PerformanceGraph.fromGraph(graph);

    const root = g.getDeepestExecutionRoot();

    expect(root).toEqual("select a");
  });

  it("it should calculate the right depths", () => {
    const graph: DirectedGraph<PerformanceEntryData> =
      new DirectedGraph<PerformanceEntryData>();

    graph.addNode("a", pdh("a"));
    graph.addNode("b", pdh("b"));
    graph.addNode("c", pdh("c"));
    graph.addNode("d", pdh("d"));

    graph.addEdge("a", "b");
    graph.addEdge("b", "c");
    graph.addEdge("d", "c");

    const g = PerformanceGraph.fromGraph(graph);

    expect(g.getExecutionDepthFromNode("a")).toEqual(2);
    expect(g.getExecutionDepthFromNode("d")).toEqual(1);
  });

  it("it should load the right graph", () => {
    const g: PerformanceGraph = PerformanceGraph.fromLogSummary(logSummary);

    expect(g.getOrder()).toEqual(335);
  });

  it("it should calculate the right depths", () => {
    const graph: DirectedGraph<PerformanceEntryData> =
      new DirectedGraph<PerformanceEntryData>();

    graph.addNode("a", pdh("a"));
    graph.addNode("b", pdh("b"));
    graph.addNode("c", pdh("c"));
    graph.addNode("d", pdh("d"));

    graph.addEdge("a", "b");
    graph.addEdge("b", "c");
    graph.addEdge("d", "c");

    console.log(JSON.stringify(graph, null, 2));

    const ss = JSON.stringify(graph.export());

    const graph2: DirectedGraph<PerformanceEntryData> =
      new DirectedGraph<PerformanceEntryData>();

    graph2.import(JSON.parse(ss));

    const gg: PerformanceGraph = PerformanceGraph.fromGraph(graph2);

    console.log(gg.getTotalTime());

    console.log(countConnectedComponents(graph));
    console.log(topologicalSort(graph));
  });
});
