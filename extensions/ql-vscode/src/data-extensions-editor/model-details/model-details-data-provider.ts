import {
  Event,
  EventEmitter,
  ThemeColor,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
} from "vscode";
import { DisposableObject } from "../../common/disposable-object";
import { ExternalApiUsage, Usage } from "../external-api-usage";
import { DatabaseItem } from "../../databases/local-databases";
import { relative } from "path";
import { CodeQLCliServer } from "../../codeql-cli/cli";

export class ModelDetailsDataProvider
  extends DisposableObject
  implements TreeDataProvider<ModelDetailsTreeViewItem>
{
  private externalApiUsages: ExternalApiUsage[] = [];
  private databaseItem: DatabaseItem | undefined = undefined;
  private sourceLocationPrefix: string | undefined = undefined;

  private readonly onDidChangeTreeDataEmitter = this.push(
    new EventEmitter<void>(),
  );

  public constructor(private readonly cliServer: CodeQLCliServer) {
    super();
  }

  public get onDidChangeTreeData(): Event<void> {
    return this.onDidChangeTreeDataEmitter.event;
  }

  public async setState(
    externalApiUsages: ExternalApiUsage[],
    databaseItem: DatabaseItem,
  ): Promise<void> {
    this.externalApiUsages = externalApiUsages;
    this.databaseItem = databaseItem;
    this.sourceLocationPrefix = await this.databaseItem.getSourceLocationPrefix(
      this.cliServer,
    );
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(item: ModelDetailsTreeViewItem): TreeItem {
    if (isExternalApiUsage(item)) {
      return {
        label: `${item.packageName}.${item.typeName}.${item.methodName}${item.methodParameters}`,
        collapsibleState: TreeItemCollapsibleState.Collapsed,
        iconPath: new ThemeIcon("symbol-method"),
      };
    } else {
      return {
        label: item.label,
        description: `${this.relativePathWithinDatabase(item.url.uri)} [${
          item.url.startLine
        }, ${item.url.endLine}]`,
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

  private relativePathWithinDatabase(uri: string): string {
    const parsedUri = Uri.parse(uri);
    if (this.sourceLocationPrefix) {
      return relative(this.sourceLocationPrefix, parsedUri.fsPath);
    } else {
      return parsedUri.fsPath;
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
