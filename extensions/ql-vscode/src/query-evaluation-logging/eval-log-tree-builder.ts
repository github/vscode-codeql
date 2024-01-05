import type { ChildEvalLogTreeItem, EvalLogTreeItem } from "./eval-log-viewer";
import type { EvalLogData as EvalLogData } from "../log-insights/log-summary-parser";

/** Builds the tree data for the evaluator log viewer for a single query run. */
export class EvalLogTreeBuilder {
  private queryName: string;
  private evalLogDataItems: EvalLogData[];

  constructor(queryName: string, evaluatorLogDataItems: EvalLogData[]) {
    this.queryName = queryName;
    this.evalLogDataItems = evaluatorLogDataItems;
  }

  async getRoots(): Promise<EvalLogTreeItem[]> {
    return await this.parseRoots();
  }

  private async parseRoots(): Promise<EvalLogTreeItem[]> {
    const roots: EvalLogTreeItem[] = [];

    // Once the viewer can show logs for multiple queries, there will be more than 1 item at the root
    // level. For now, there will always be one root (the one query being shown).
    const queryItem: EvalLogTreeItem = {
      label: this.queryName,
      children: [], // Will assign predicate items as children shortly.
    };

    // Display descriptive message when no data exists
    if (this.evalLogDataItems.length === 0) {
      const noResultsItem: ChildEvalLogTreeItem = {
        label: "No predicates evaluated in this query run.",
        parent: queryItem,
        children: [],
      };
      queryItem.children.push(noResultsItem);
    }

    // For each predicate, create a TreeItem object with appropriate parents/children
    this.evalLogDataItems.forEach((logDataItem) => {
      const predicateLabel = `${logDataItem.predicateName} (${logDataItem.resultSize} tuples, ${logDataItem.millis} ms)`;
      const predicateItem: ChildEvalLogTreeItem = {
        label: predicateLabel,
        parent: queryItem,
        children: [], // Will assign pipeline items as children shortly.
      };
      for (const [pipelineName, steps] of Object.entries(logDataItem.ra)) {
        const pipelineLabel = `Pipeline: ${pipelineName}`;
        const pipelineItem: ChildEvalLogTreeItem = {
          label: pipelineLabel,
          parent: predicateItem,
          children: [], // Will assign step items as children shortly.
        };
        predicateItem.children.push(pipelineItem);

        pipelineItem.children = steps.map((step: string) => ({
          label: step,
          parent: pipelineItem,
          children: [],
        }));
      }
      queryItem.children.push(predicateItem);
    });

    roots.push(queryItem);
    return roots;
  }
}
