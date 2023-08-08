import {
  Event,
  EventEmitter,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
} from "vscode";
import { DisposableObject } from "../../common/disposable-object";
import { ExternalApiUsage, Usage } from "../external-api-usage";

export class ModelDetailsDataProvider
  extends DisposableObject
  implements TreeDataProvider<ModelDetailsTreeViewItem>
{
  private externalApiUsages: ExternalApiUsage[] = [];

  private readonly onDidChangeTreeDataEmitter = this.push(
    new EventEmitter<void>(),
  );

  public get onDidChangeTreeData(): Event<void> {
    return this.onDidChangeTreeDataEmitter.event;
  }

  public setExternalApiUsages(externalApiUsages: ExternalApiUsage[]): void {
    this.externalApiUsages = externalApiUsages;
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
}

type ModelDetailsTreeViewItem = ExternalApiUsage | Usage;

function isExternalApiUsage(
  item: ModelDetailsTreeViewItem,
): item is ExternalApiUsage {
  return (item as any).usages !== undefined;
}
