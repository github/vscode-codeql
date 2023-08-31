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
import { INITIAL_HIDE_MODELED_APIS_VALUE } from "../shared/hide-modeled-apis";

export class MethodsUsageDataProvider
  extends DisposableObject
  implements TreeDataProvider<MethodsUsageTreeViewItem>
{
  private externalApiUsages: ExternalApiUsage[] = [];
  private databaseItem: DatabaseItem | undefined = undefined;
  private sourceLocationPrefix: string | undefined = undefined;
  private hideModeledApis: boolean = INITIAL_HIDE_MODELED_APIS_VALUE;

  private readonly onDidChangeTreeDataEmitter = this.push(
    new EventEmitter<void>(),
  );

  public constructor(private readonly cliServer: CodeQLCliServer) {
    super();
  }

  public get onDidChangeTreeData(): Event<void> {
    return this.onDidChangeTreeDataEmitter.event;
  }

  /**
   * Update the data displayed in the tree view.
   *
   * Will only trigger an update if the data has changed. This relies on
   * object identity, so be sure to not mutate the data passed to this
   * method and instead always pass new objects/arrays.
   */
  public async setState(
    externalApiUsages: ExternalApiUsage[],
    databaseItem: DatabaseItem,
    hideModeledApis: boolean,
  ): Promise<void> {
    if (
      this.externalApiUsages !== externalApiUsages ||
      this.databaseItem !== databaseItem ||
      this.hideModeledApis !== hideModeledApis
    ) {
      this.externalApiUsages = externalApiUsages;
      this.databaseItem = databaseItem;
      this.sourceLocationPrefix =
        await this.databaseItem.getSourceLocationPrefix(this.cliServer);
      this.hideModeledApis = hideModeledApis;

      this.onDidChangeTreeDataEmitter.fire();
    }
  }

  getTreeItem(item: MethodsUsageTreeViewItem): TreeItem {
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
          command: "codeQLModelEditor.jumpToUsageLocation",
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

  getChildren(item?: MethodsUsageTreeViewItem): MethodsUsageTreeViewItem[] {
    if (item === undefined) {
      if (this.hideModeledApis) {
        return this.externalApiUsages.filter((api) => !api.supported);
      } else {
        return this.externalApiUsages;
      }
    } else if (isExternalApiUsage(item)) {
      return item.usages;
    } else {
      return [];
    }
  }

  getParent(
    item: MethodsUsageTreeViewItem,
  ): MethodsUsageTreeViewItem | undefined {
    if (isExternalApiUsage(item)) {
      return undefined;
    } else {
      return this.externalApiUsages.find((e) => e.usages.includes(item));
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

export type MethodsUsageTreeViewItem = ExternalApiUsage | Usage;

function isExternalApiUsage(
  item: MethodsUsageTreeViewItem,
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
