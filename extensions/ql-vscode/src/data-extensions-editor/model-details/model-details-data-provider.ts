import {
  Event,
  EventEmitter,
  ThemeColor,
  ThemeIcon,
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
        iconPath: new ThemeIcon("symbol-method"),
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
        iconPath: new ThemeIcon("error", new ThemeColor("errorForeground")),
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
