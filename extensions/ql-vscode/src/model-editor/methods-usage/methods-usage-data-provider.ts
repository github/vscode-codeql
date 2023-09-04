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
import { Method, Usage } from "../method";
import { DatabaseItem } from "../../databases/local-databases";
import { relative } from "path";
import { CodeQLCliServer } from "../../codeql-cli/cli";
import { INITIAL_HIDE_MODELED_APIS_VALUE } from "../shared/hide-modeled-apis";

export class MethodsUsageDataProvider
  extends DisposableObject
  implements TreeDataProvider<MethodsUsageTreeViewItem>
{
  private methods: Method[] = [];
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
    methods: Method[],
    databaseItem: DatabaseItem,
    hideModeledApis: boolean,
  ): Promise<void> {
    if (
      this.methods !== methods ||
      this.databaseItem !== databaseItem ||
      this.hideModeledApis !== hideModeledApis
    ) {
      this.methods = methods;
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
      const method = this.getParent(item);
      return {
        label: item.label,
        description: `${this.relativePathWithinDatabase(item.url.uri)} [${
          item.url.startLine
        }, ${item.url.endLine}]`,
        collapsibleState: TreeItemCollapsibleState.None,
        command: {
          title: "Show usage",
          command: "codeQLModelEditor.jumpToUsageLocation",
          arguments: [method, item, this.databaseItem],
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
        return this.methods.filter((api) => !api.supported);
      } else {
        return this.methods;
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
      return this.methods.find((e) => e.usages.includes(item));
    }
  }

  public resolveCanonicalUsage(usage: Usage): Usage | undefined {
    for (const method of this.methods) {
      for (const u of method.usages) {
        if (usagesAreEqual(u, usage)) {
          return u;
        }
      }
    }
    return undefined;
  }
}

export type MethodsUsageTreeViewItem = Method | Usage;

function isExternalApiUsage(item: MethodsUsageTreeViewItem): item is Method {
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
