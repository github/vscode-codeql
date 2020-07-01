import { QueryWithResults } from '../run-queries';
import { CodeQLCliServer } from '../cli';
import { DecodedBqrsChunk, BqrsId, EntityValue } from '../bqrs-cli-types';
import { DatabaseItem } from '../databases';
import { AstItem, RootAstItem } from '../astViewer';

/**
 * A class that wraps a tree of QL results from a query that
 * has an @kind of graph
 */
// RENAME to ASTParser / ASTCreator
export default class AstBuilder {

  private roots: RootAstItem[] | undefined;
  private bqrsPath: string;
  constructor(
    queryResults: QueryWithResults,
    private cli: CodeQLCliServer,
    public db: DatabaseItem,
    public fileName: string
  ) {
    this.bqrsPath = queryResults.query.resultsPaths.resultsPath;
  }

  async getRoots(): Promise<RootAstItem[]> {
    if (!this.roots) {
      this.roots = await this.parseRoots();
    }
    return this.roots;
  }

  private async parseRoots(): Promise<RootAstItem[]> {
    const [nodeTuples, edgeTuples, graphProperties] = await Promise.all([
      await this.cli.bqrsDecode(this.bqrsPath, 'nodes'),
      await this.cli.bqrsDecode(this.bqrsPath, 'edges'),
      await this.cli.bqrsDecode(this.bqrsPath, 'graphProperties'),
    ]);

    if (!this.isValidGraph(graphProperties)) {
      throw new Error('AST is invalid');
    }

    const idToItem = new Map<BqrsId, AstItem | RootAstItem>();
    const parentToChildren = new Map<BqrsId, BqrsId[]>();
    const childToParent = new Map<BqrsId, BqrsId>();
    const astOrder = new Map<BqrsId, number>();
    const roots = [];

    // Build up the parent-child relationships
    edgeTuples.tuples.forEach(tuple => {
      const from = tuple[0] as EntityValue;
      const to = tuple[1] as EntityValue;
      const toId = to.id!;
      const fromId = from.id!;

      if (tuple[2] === 'semmle.order') {
        astOrder.set(toId, Number(tuple[3]));
      } else if (tuple[2] === 'semmle.label') {
        childToParent.set(toId, fromId);
        let children = parentToChildren.get(fromId);
        if (!children) {
          parentToChildren.set(fromId, children = []);
        }
        children.push(toId);
      }
    });

    // populate parents and children
    nodeTuples.tuples.forEach(tuple => {
      const entity = tuple[0] as EntityValue;
      const id = entity.id!;

      if (tuple[1] === 'semmle.order') {
        astOrder.set(id, Number(tuple[2]));

      } else if (tuple[1] === 'semmle.label') {
        const item = {
          id,
          label: entity.label,
          location: entity.url,
          children: [] as AstItem[],
          order: Number.MAX_SAFE_INTEGER
        };

        idToItem.set(id, item as RootAstItem);
        const parent = idToItem.get(childToParent.get(id) || -1);

        if (parent) {
          const astItem = item as AstItem;
          astItem.parent = parent;
          parent.children.push(astItem);
        }
        const children = parentToChildren.get(id) || [];
        children.forEach(childId => {
          const child = idToItem.get(childId) as AstItem | undefined;
          if (child) {
            child.parent = item;
            item.children.push(child);
          }
        });
      }
    });

    // find the roots and add the order
    for(const [, item] of idToItem) {
      item.order = astOrder.has(item.id)
        ? astOrder.get(item.id)!
        : Number.MAX_SAFE_INTEGER;

      if (!('parent' in item)) {
        roots.push(item);
      }
    }
    return roots;
  }

  private isValidGraph(graphProperties: DecodedBqrsChunk) {
    const tuple = graphProperties?.tuples?.find(t => t[0] === 'semmle.graphKind');
    return tuple?.[1] === 'tree';
  }
}
