import { DirectedGraph } from "graphology";
import { dfsFromNode } from "graphology-traversal/dfs";
import { topologicalSort } from "graphology-dag/topological-sort";
import {
  PerformanceLogEntry,
  Position,
  jsonLogToPerformanceLogEntries,
  jsonLogToArrayOfJSON,
  indexPerformanceLogEntries,
  pruneMissingDependencies,
} from "./performance-editor-log-reader";

/**
 * Sketch of interface this model supports (numbers for illustration purposes only)
 *
 * | Predicate       | Self Time | Aggregate Time | % of total (self) | % of total (aggregate) | file
 * -----------------------------------------------------------------------------------------------------
 * | > The predicate | 0.2s      | 1.2s           | 100%              | 100%                   | file.ql
 * -----------------------------------------------------------------------------------------------------
 * |
 * |     [    top level predicate     ] (hover over to view times)
 * |     [ predicate a ] [ predicate b]
 * |     [        the predicate       ]
 * --------------------------------------------------------------------------
 *
 * Expanding the triangle will show the dependencies of the predicate.
 *
 */

export interface PerformanceEntryData {
  raHash: string;
  completionTime: string;
  position: Position;
  evaluationStrategy: string;
  millis: number;
  predicateName: string;
}

export interface PerformanceEditorRow {
  predicateName: string;
  selfTime: number;
  selfTimeAmortized: number;
  aggregateTime: number;
  aggregateTimeAmortized: number;
  percentOfTotalSelf: number;
  percentOfTotalSelfAmortized: number;
  percentOfTotalAggregate: number;
  percentOfTotalAggregateAmortized: number;
  uses: number;
  position: Position;
  dependencies?: PerformanceEditorDetail[];
  raHash: string;
}
export interface PerformanceEditorDetail {
  detail: PerformanceEditorRow;
  depth: number;
}

export class PerformanceGraph {
  private graph: DirectedGraph<PerformanceEntryData> =
    new DirectedGraph<PerformanceEntryData>();
  private totalTime: number | undefined;
  private topologicalOrder: string[] | undefined;

  /**
   * Factory method for creating a PerformanceGraph from a JSON summary log.
   * @param log A JSON summary log.
   * @returns A handle to the performance graph.
   */
  public static fromLogSummary(log: string): PerformanceGraph {
    const g = new PerformanceGraph();

    // convert the log file to an array of PerformanceLogEntry objects.
    const allEntries: PerformanceLogEntry[] = jsonLogToPerformanceLogEntries(
      jsonLogToArrayOfJSON(log),
    );

    // create an index of the raHashes for faster lookups
    const raDatabase: Map<string, PerformanceLogEntry> =
      indexPerformanceLogEntries(allEntries);

    // filter the entries dependencies since it is possible some of the dependencies
    // reference things that may not exist in the final graph
    pruneMissingDependencies(allEntries, raDatabase);

    // first add all the nodes to the graph
    for (const entry of allEntries) {
      g.graph.addNode(entry.raHash, {
        raHash: entry.raHash,
        completionTime: entry.completionTime,
        position: entry.position,
        evaluationStrategy: entry.evaluationStrategy,
        millis: entry.millis,
        predicateName: entry.predicateName,
      });
    }
    // add all the edges to the graph
    for (const entry of allEntries) {
      for (const dependency of entry.dependencies) {
        g.graph.addEdge(entry.raHash, dependency.raHash);
      }
    }

    return g;
  }

  /**
   * Gets the number of nodes in the graph.
   * @returns The order of this graph.
   */
  public getOrder(): number {
    return this.graph.order;
  }

  /**
   * Creates a performance graph from a graphology graph.
   * @returns A handle to the performance graph.
   */
  public static fromGraph(
    graph: DirectedGraph<PerformanceEntryData>,
  ): PerformanceGraph {
    const g = new PerformanceGraph();
    g.graph = graph;
    return g;
  }

  /**
   * Gets all the possible execution roots.
   * @param graph the graph to search.
   * @returns list of possible roots.
   */
  public findExecutionRoots(): string[] {
    return this.graph.filterNodes((node) => this.graph.inDegree(node) === 0);
  }

  /**
   * Gets the deepest execution root from a graph
   * @param restrictToSelects true if it should only consider roots that are selects.
   * @returns The deepest execution root.
   */
  public getDeepestExecutionRoot(restrictToSelects = true): string | undefined {
    let executionRoot: string | undefined;
    let executionDepth = 0;

    const executionRoots = this.findExecutionRoots();

    for (const root of executionRoots) {
      const depth = this.getExecutionDepthFromNode(root);

      if (
        depth > executionDepth &&
        (!restrictToSelects ||
          this.graph.getNodeAttributes(root).predicateName.indexOf("select") >
            -1)
      ) {
        executionDepth = depth;
        executionRoot = root;
      }
    }

    return executionRoot;
  }

  /**
   * Gets the execution depth starting at a given root.
   * @param root the root to start from
   * @returns the execution depth.
   */
  public getExecutionDepthFromNode(root: string): number {
    let currentDepth = 0;

    dfsFromNode(this.graph, root, function (_node, _attr, depth) {
      currentDepth = Math.max(currentDepth, depth);
    });

    return currentDepth;
  }

  /**
   * Gets all the nodes in topological order.
   * @returns The nodes in topological order.
   */
  public getTopologicalOrder(): string[] {
    if (this.topologicalOrder === undefined) {
      this.topologicalOrder = topologicalSort(this.graph);
    }

    return this.topologicalOrder;
  }

  /**
   * Prunes a graph, excluding nodes not reachable from the root.
   * @param root the root to prune to.
   */
  public pruneToRoot(root: string): void {
    // first perform a traversal to find all the nodes that are reachable from the root

    const reachableNodes = new Set<string>();

    reachableNodes.add(root);

    dfsFromNode(this.graph, root, function (node, _attr, _depth) {
      reachableNodes.add(node);
    });

    const toPrune = this.graph.filterNodes((e) => !reachableNodes.has(e));

    for (const node of toPrune) {
      this.graph.dropNode(node);
    }
  }

  /**
   * Computes the rows for a given graph.
   * @returns the rows.
   */
  public buildPerformanceEditorRows(): PerformanceEditorRow[] {
    return this.graph.mapNodes((node) => {
      const row = this.buildPerformanceEditorRow(node);
      row.dependencies = this.buildPerformanceEditorDetailForRow(row);
      return row;
    });
  }

  public getNumberOfPredicateUses(node: string): number {
    return this.graph.inDegree(node) + 1;
  }

  public getCostOfNode(node: string, amortize = false): number {
    const attributes = this.graph.getNodeAttributes(node);

    if (amortize) {
      return attributes.millis / this.getNumberOfPredicateUses(node);
    }

    return attributes.millis;
  }
  /**
   * Computes the row for a given node.
   * @param node The node to compute.
   * @returns the row.
   */
  public buildPerformanceEditorRow(
    node: string,
    parent?: PerformanceEditorRow,
    orderedAggregateTime?: number,
    orderedAggregateTimeAmortized?: number,
  ): PerformanceEditorRow {
    const attributes = this.graph.getNodeAttributes(node);

    // in the case where the parent node isn't specified,
    // the amortized "total" time remains constant since the "total"
    // calculation is based on simply summing (one time) all nodes.
    let totalTime = this.getTotalTime();
    let totalTimeAmortized = totalTime;

    // if the parent node is specified, the "total time"
    // is based on the parent node's total time. This calculation
    // must take into account if the time was amortized or not.
    if (parent) {
      totalTime = parent.aggregateTime;
      totalTimeAmortized = parent.aggregateTimeAmortized;
    }

    const predicateName = attributes.predicateName;
    const selfTime = this.getCostOfNode(node);
    const selfTimeAmortized = this.getCostOfNode(node, true);

    let aggregateTime = 0;
    let aggregateTimeAmortized = 0;

    if (
      orderedAggregateTime === undefined ||
      orderedAggregateTimeAmortized === undefined
    ) {
      aggregateTime = this.computeAggregateTime(node);
      aggregateTimeAmortized = this.computeAggregateTime(node, true);
    } else {
      aggregateTime = orderedAggregateTime;
      aggregateTimeAmortized = orderedAggregateTimeAmortized;
    }

    const percentOfTotalSelf = (selfTime / totalTime) * 100;
    const percentOfTotalSelfAmortized =
      (selfTimeAmortized / totalTimeAmortized) * 100;
    const percentOfTotalAggregate = (aggregateTime / totalTime) * 100;
    const percentOfTotalAggregateAmortized =
      (aggregateTimeAmortized / totalTimeAmortized) * 100;
    const position = attributes.position;
    const uses = this.getNumberOfPredicateUses(node);
    const raHash = node;

    return {
      predicateName,
      selfTime,
      selfTimeAmortized,
      aggregateTime,
      aggregateTimeAmortized,
      percentOfTotalSelf,
      percentOfTotalSelfAmortized,
      percentOfTotalAggregate,
      percentOfTotalAggregateAmortized,
      position,
      uses,
      raHash,
    };
  }

  /**
   * Creates an individual performance detail row.
   * @param row The row to compute the details for.
   * @returns
   */
  public buildPerformanceEditorDetailForRow(
    row: PerformanceEditorRow,
  ): PerformanceEditorDetail[] {
    // obtain a list of all of the children.
    const children: string[] = [];
    dfsFromNode(this.graph, row.raHash, function (node, _attr, _depth) {
      children.push(node);
    });

    // sort the children by their topological sort order.
    children.sort(
      (a, b) =>
        this.getTopologicalOrder().indexOf(a) -
        this.getTopologicalOrder().indexOf(b),
    );

    // assign depths to each child
    const details: PerformanceEditorDetail[] = children.map((child, index) => {
      // from the starting point on, compute the aggregate time for this child.
      // note that we preserve the ordering here because it is a simplified ordering
      // of the dependency graph that is easier to understand.

      // It also has a clear invariant that the aggregate time
      const aggregateTime = this.computeAggregateTimeFromOrdering(
        index,
        children,
      );
      const aggregateTimeAmortized = this.computeAggregateTimeFromOrdering(
        index,
        children,
        true,
      );

      return {
        detail: this.buildPerformanceEditorRow(
          child,
          row,
          aggregateTime,
          aggregateTimeAmortized,
        ),
        depth: index,
      };
    });

    // lastly, to make the UI consistent, we perform a merge between the levels.
    this.mergeDetailLevels(details);
    return details;
  }

  /**
   * Groups all the details at a given level.
   * @param details The full list of details.
   * @param level The level to group by
   * @returns Grouped details at `level`.
   */
  public static groupByLevel(
    details: PerformanceEditorDetail[],
    level: number,
  ): PerformanceEditorDetail[] {
    return details.filter((detail) => detail.depth === level);
  }
  /**
   * Determines if `next` may be merged with the other nodes at `level`. In general,
   * this is true if there is no path from any of the nodes at `level` to `next`, meaning, they don't
   * need `next` to be computed first.
   * @param details the full list of nodes.
   * @param level the level to search at.
   * @param next the node to test for mergeability.
   * @returns true if they are mergeable.
   */
  public isLevelMergable(
    details: PerformanceEditorDetail[],
    level: number,
    next: PerformanceEditorDetail,
  ): boolean {
    const group = PerformanceGraph.groupByLevel(details, level);

    // it's already higher up so it can't be merged.
    if (next.depth < level) {
      return false;
    }

    let hasPath = false;

    // ensure that none of the nodes in the group have a edge to this node
    for (const n of group) {
      dfsFromNode(this.graph, n.detail.raHash, function (node, _attr, _depth) {
        if (node === next.detail.raHash) {
          hasPath = true;
        }
      });
    }

    if (hasPath) {
      return false;
    }

    return true;
  }

  /**
   * Merges graph levels. This operates taking a list of topologically sorted rows and merging them.
   * @param details The detail rows to perform a merge on. These should be sorted by topological sort order.
   * Additionally, it is important that the depth of each row is correct wrt the other rows.
   * @returns The merged detail rows.
   */
  public mergeDetailLevels(details: PerformanceEditorDetail[]): void {
    // iterate over each detail level pairwise
    for (let i = 0; i < details.length - 1; i++) {
      const currentLevel = details[i];
      const nextLevel = details[i + 1];

      // if the current level is not mergable, skip it.
      if (!this.isLevelMergable(details, currentLevel.depth, nextLevel)) {
        continue;
      }

      // merge the current level with the next level.
      nextLevel.depth = currentLevel.depth;
    }
  }

  /**
   * Computes total serialized time.
   * @returns the total time in ms.
   */
  public getTotalTime(): number {
    if (this.totalTime === undefined) {
      let total = 0;

      this.graph.forEachNode((node) => {
        total += this.graph.getNodeAttributes(node).millis;
      });
      this.totalTime = total;
    }
    return this.totalTime;
  }

  /**
   * Compute the total time of a given root plus all of its dependencies.
   * @param root The root to start from.
   * @returns The total time of a given root plus all of its dependencies.
   */
  public computeAggregateTime(root: string, amortize = false): number {
    let total = 0;
    dfsFromNode(this.graph, root, (node, _attr, _depth) => {
      total += this.getCostOfNode(node, amortize);
    });
    return total;
  }

  public computeAggregateTimeFromOrdering(
    childIdx: number,
    ordering: string[],
    amortize = false,
  ): number {
    let total = 0;

    // starting at the child index, compute the aggregate time.
    for (let i = childIdx; i < ordering.length; i++) {
      total += this.getCostOfNode(ordering[i], amortize);
    }
    return total;
  }
}
