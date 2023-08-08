import {
  Event,
  EventEmitter,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
} from "vscode";
import { DisposableObject } from "../../common/disposable-object";
import { ExternalApiUsage, Usage } from "../external-api-usage";
import { DatabaseItem } from "../../databases/local-databases";

export class ModelDetailsDataProvider
  extends DisposableObject
  implements TreeDataProvider<ModelDetailsTreeViewItem>
{
  private externalApiUsages: ExternalApiUsage[] = [];
  private databaseItem: DatabaseItem | undefined = undefined;

  private readonly onDidChangeTreeDataEmitter = this.push(
    new EventEmitter<void>(),
  );

  public get onDidChangeTreeData(): Event<void> {
    return this.onDidChangeTreeDataEmitter.event;
  }

  public setState(
    externalApiUsages: ExternalApiUsage[],
    databaseItem: DatabaseItem,
  ): void {
    this.externalApiUsages = externalApiUsages;
    this.databaseItem = databaseItem;
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(item: ModelDetailsTreeViewItem): TreeItem {
    if (isExternalApiUsage(item)) {
      return {
        label: item.signature,
        collapsibleState: TreeItemCollapsibleState.Collapsed,
      };
    } else {
      return {
        label: item.label,
        collapsibleState: TreeItemCollapsibleState.None,
        command: {
          title: "Show usage",
          command: "codeQLDataExtensionsEditor.jumpToUsageLocation",
          arguments: [item, this.databaseItem],
        },
      };
    }
  }

  getChildren(item?: ModelDetailsTreeViewItem): ModelDetailsTreeViewItem[] {
    if (item === undefined) {
      return this.externalApiUsages;
    } else if (isExternalApiUsage(item)) {
      return item.usages;
    } else {
      return [];
    }
  }

  public resolveCanonicalUsage(usage: Usage): Usage | undefined {
    for (const externalApiUsage of this.externalApiUsages) {
      for (const u of externalApiUsage.usages) {
        if (usagesAreEqual(u, usage)) {
          return u;
        }
      }
    }
    return undefined;
  }
}

export type ModelDetailsTreeViewItem = ExternalApiUsage | Usage;

function isExternalApiUsage(
  item: ModelDetailsTreeViewItem,
): item is ExternalApiUsage {
  return (item as any).usages !== undefined;
}

function usagesAreEqual(u1: Usage, u2: Usage): boolean {
  return (
    u1.label === u2.label &&
    u1.classification === u2.classification &&
    u1.url.uri === u2.url.uri &&
    u1.url.startLine === u2.url.startLine &&
    u1.url.startColumn === u2.url.startColumn &&
    u1.url.endLine === u2.url.endLine &&
    u1.url.endColumn === u2.url.endColumn
  );
}
