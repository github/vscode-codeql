import type { CodeQLCliServer } from "../../codeql-cli/cli";
import type {
  DecodedBqrsChunk,
  BqrsId,
  BqrsEntityValue,
} from "../../common/bqrs-cli-types";
import type { DatabaseItem } from "../../databases/local-databases";
import type { ChildAstItem, AstItem } from "./ast-viewer";
import type { Uri } from "vscode";
import type { QueryOutputDir } from "../../local-queries/query-output-dir";
import { fileRangeFromURI } from "../contextual/file-range-from-uri";
import { mapUrlValue } from "../../common/bqrs-raw-results-mapper";

/**
 * A class that wraps a tree of QL results from a query that
 * has an @kind of graph
 */
export class AstBuilder {
  private roots: AstItem[] | undefined;
  private bqrsPath: string;
  constructor(
    outputDir: QueryOutputDir,
    private cli: CodeQLCliServer,
    public db: DatabaseItem,
    public fileName: Uri,
  ) {
    this.bqrsPath = outputDir.bqrsPath;
  }

  async getRoots(): Promise<AstItem[]> {
    if (!this.roots) {
      this.roots = await this.parseRoots();
    }
    return this.roots;
  }

  private async parseRoots(): Promise<AstItem[]> {
    const options = { entities: ["id", "url", "string"] };
    const [nodeTuples, edgeTuples, graphProperties] = await Promise.all([
      await this.cli.bqrsDecode(this.bqrsPath, "nodes", options),
      await this.cli.bqrsDecode(this.bqrsPath, "edges", options),
      await this.cli.bqrsDecode(this.bqrsPath, "graphProperties", options),
    ]);

    if (!this.isValidGraph(graphProperties)) {
      throw new Error("AST is invalid");
    }

    const idToItem = new Map<BqrsId, AstItem>();
    const parentToChildren = new Map<BqrsId, BqrsId[]>();
    const childToParent = new Map<BqrsId, BqrsId>();
    const astOrder = new Map<BqrsId, number>();
    const edgeLabels = new Map<BqrsId, string>();
    const roots = [];

    // Build up the parent-child relationships
    edgeTuples.tuples.forEach((tuple) => {
      const [source, target, tupleType, value] = tuple as [
        BqrsEntityValue,
        BqrsEntityValue,
        string,
        string,
      ];
      const sourceId = source.id!;
      const targetId = target.id!;

      switch (tupleType) {
        case "semmle.order":
          astOrder.set(targetId, Number(value));
          break;

        case "semmle.label": {
          childToParent.set(targetId, sourceId);
          let children = parentToChildren.get(sourceId);
          if (!children) {
            parentToChildren.set(sourceId, (children = []));
          }
          children.push(targetId);

          // ignore values that indicate a numeric order.
          if (!Number.isFinite(Number(value))) {
            edgeLabels.set(targetId, value);
          }
          break;
        }

        default:
        // ignore other tupleTypes since they are not needed by the ast viewer
      }
    });

    // populate parents and children
    nodeTuples.tuples.forEach((tuple) => {
      const [entity, tupleType, value] = tuple as [
        BqrsEntityValue,
        string,
        string,
      ];
      const id = entity.id!;

      switch (tupleType) {
        case "semmle.order":
          astOrder.set(id, Number(value));
          break;

        case "semmle.label": {
          // If an edge label exists, include it and separate from the node label using ':'
          const nodeLabel = value ?? entity.label;
          const edgeLabel = edgeLabels.get(id);
          const label = [edgeLabel, nodeLabel].filter((e) => e).join(": ");
          const item = {
            id,
            label,
            location: entity.url ? mapUrlValue(entity.url) : undefined,
            fileLocation: fileRangeFromURI(entity.url, this.db),
            children: [] as ChildAstItem[],
            order: Number.MAX_SAFE_INTEGER,
          };

          idToItem.set(id, item);
          const parent = idToItem.get(
            childToParent.has(id) ? childToParent.get(id)! : -1,
          );

          if (parent) {
            const astItem = item as ChildAstItem;
            astItem.parent = parent;
            parent.children.push(astItem);
          }
          const children = parentToChildren.has(id)
            ? parentToChildren.get(id)!
            : [];
          children.forEach((childId) => {
            const child = idToItem.get(childId) as ChildAstItem | undefined;
            if (child) {
              child.parent = item;
              item.children.push(child);
            }
          });
          break;
        }

        default:
        // ignore other tupleTypes since they are not needed by the ast viewer
      }
    });

    // find the roots and add the order
    for (const [, item] of idToItem) {
      item.order = astOrder.has(item.id)
        ? astOrder.get(item.id)!
        : Number.MAX_SAFE_INTEGER;

      if (!("parent" in item)) {
        roots.push(item);
      }
    }
    return roots;
  }

  private isValidGraph(graphProperties: DecodedBqrsChunk) {
    const tuple = graphProperties?.tuples?.find(
      (t) => t[0] === "semmle.graphKind",
    );
    return tuple?.[1] === "tree";
  }
}
