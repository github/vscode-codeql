import type { Event, TreeDataProvider, TreeItem } from "vscode";
import {
  EventEmitter,
  ThemeColor,
  ThemeIcon,
  TreeItemCollapsibleState,
  Uri,
} from "vscode";
import { DisposableObject } from "../../common/disposable-object";
import type { Method, Usage } from "../method";
import { canMethodBeModeled } from "../method";
import type { DatabaseItem } from "../../databases/local-databases";
import { relative } from "path";
import type { CodeQLCliServer } from "../../codeql-cli/cli";
import { INITIAL_HIDE_MODELED_METHODS_VALUE } from "../shared/hide-modeled-methods";
import { getModelingStatus } from "../shared/modeling-status";
import { assertNever } from "../../common/helpers-pure";
import type { ModeledMethod } from "../modeled-method";
import { groupMethods, sortGroupNames } from "../shared/sorting";
import type { Mode } from "../shared/mode";
import { INITIAL_MODE } from "../shared/mode";
import type { UrlValueResolvable } from "../../common/raw-result-types";

export class MethodsUsageDataProvider
  extends DisposableObject
  implements TreeDataProvider<MethodsUsageTreeViewItem>
{
  private methods: readonly Method[] = [];
  // sortedMethods is a separate field so we can check if the methods have changed
  // by reference, which is faster than checking if the methods have changed by value.
  private sortedTreeItems: readonly MethodTreeViewItem[] = [];
  private databaseItem: DatabaseItem | undefined = undefined;
  private sourceLocationPrefix: string | undefined = undefined;
  private hideModeledMethods: boolean = INITIAL_HIDE_MODELED_METHODS_VALUE;
  private mode: Mode = INITIAL_MODE;
  private modeledMethods: Readonly<Record<string, readonly ModeledMethod[]>> =
    {};
  private modifiedMethodSignatures: ReadonlySet<string> = new Set();

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
    methods: readonly Method[],
    databaseItem: DatabaseItem,
    hideModeledMethods: boolean,
    mode: Mode,
    modeledMethods: Readonly<Record<string, readonly ModeledMethod[]>>,
    modifiedMethodSignatures: ReadonlySet<string>,
  ): Promise<void> {
    if (
      this.methods !== methods ||
      this.databaseItem !== databaseItem ||
      this.hideModeledMethods !== hideModeledMethods ||
      this.mode !== mode ||
      this.modeledMethods !== modeledMethods ||
      this.modifiedMethodSignatures !== modifiedMethodSignatures
    ) {
      this.methods = methods;
      this.sortedTreeItems = createTreeItems(createGroups(methods, mode));
      this.databaseItem = databaseItem;
      this.sourceLocationPrefix =
        await this.databaseItem.getSourceLocationPrefix(this.cliServer);
      this.hideModeledMethods = hideModeledMethods;
      this.mode = mode;
      this.modeledMethods = modeledMethods;
      this.modifiedMethodSignatures = modifiedMethodSignatures;

      this.onDidChangeTreeDataEmitter.fire();
    }
  }

  getTreeItem(item: MethodsUsageTreeViewItem): TreeItem {
    if (isMethodTreeViewItem(item)) {
      const { method } = item;

      return {
        label: `${method.packageName}.${method.typeName}.${method.methodName}${method.methodParameters}`,
        collapsibleState: TreeItemCollapsibleState.Collapsed,
        iconPath: this.getModelingStatusIcon(method),
      };
    } else {
      const { method, usage } = item;

      const description =
        usage.url.type === "wholeFileLocation"
          ? this.relativePathWithinDatabase(usage.url.uri)
          : `${this.relativePathWithinDatabase(usage.url.uri)} [${
              usage.url.startLine
            }, ${usage.url.endLine}]`;

      return {
        label: usage.label,
        description,
        collapsibleState: TreeItemCollapsibleState.None,
        command: {
          title: "Show usage",
          command: "codeQLModelEditor.jumpToMethod",
          arguments: [method, usage, this.databaseItem],
        },
      };
    }
  }

  private getModelingStatusIcon(method: Method): ThemeIcon {
    const modeledMethods = this.modeledMethods[method.signature] ?? [];
    const modifiedMethod = this.modifiedMethodSignatures.has(method.signature);

    const status = getModelingStatus(modeledMethods, modifiedMethod);
    switch (status) {
      case "unmodeled":
        return new ThemeIcon("error", new ThemeColor("errorForeground"));
      case "unsaved":
        return new ThemeIcon("pass", new ThemeColor("testing.iconPassed"));
      case "saved":
        return new ThemeIcon(
          "pass-filled",
          new ThemeColor("testing.iconPassed"),
        );
      default:
        assertNever(status);
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
      if (this.hideModeledMethods) {
        return this.sortedTreeItems.filter((api) =>
          canMethodBeModeled(
            api.method,
            this.modeledMethods[api.method.signature] ?? [],
            this.modifiedMethodSignatures.has(api.method.signature),
          ),
        );
      } else {
        return [...this.sortedTreeItems];
      }
    } else if (isMethodTreeViewItem(item)) {
      return item.children;
    } else {
      return [];
    }
  }

  getParent(
    item: MethodsUsageTreeViewItem,
  ): MethodsUsageTreeViewItem | undefined {
    if (isMethodTreeViewItem(item)) {
      return undefined;
    } else {
      return item.parent;
    }
  }

  public resolveUsageTreeViewItem(
    methodSignature: string,
    usage: Usage,
  ): UsageTreeViewItem | undefined {
    const method = this.sortedTreeItems.find(
      (m) => m.method.signature === methodSignature,
    );
    if (!method) {
      return undefined;
    }

    return method.children.find((u) => usagesAreEqual(u.usage, usage));
  }
}

type MethodTreeViewItem = {
  method: Method;
  children: UsageTreeViewItem[];
};

type UsageTreeViewItem = {
  method: Method;
  usage: Usage;
  parent: MethodTreeViewItem;
};

export type MethodsUsageTreeViewItem = MethodTreeViewItem | UsageTreeViewItem;

function isMethodTreeViewItem(
  item: MethodsUsageTreeViewItem,
): item is MethodTreeViewItem {
  return "children" in item && "method" in item;
}

function usagesAreEqual(u1: Usage, u2: Usage): boolean {
  return (
    u1.label === u2.label &&
    u1.classification === u2.classification &&
    urlValueResolvablesAreEqual(u1.url, u2.url)
  );
}

function urlValueResolvablesAreEqual(
  u1: UrlValueResolvable,
  u2: UrlValueResolvable,
): boolean {
  if (u1.type !== u2.type) {
    return false;
  }

  if (u1.type === "wholeFileLocation" && u2.type === "wholeFileLocation") {
    return u1.uri === u2.uri;
  }

  if (u1.type === "lineColumnLocation" && u2.type === "lineColumnLocation") {
    return (
      u1.uri === u2.uri &&
      u1.startLine === u2.startLine &&
      u1.startColumn === u2.startColumn &&
      u1.endLine === u2.endLine &&
      u1.endColumn === u2.endColumn
    );
  }

  return false;
}

function createGroups(methods: readonly Method[], mode: Mode): Method[] {
  const grouped = groupMethods(methods, mode);
  return sortGroupNames(grouped).flatMap((groupName) => grouped[groupName]);
}

function createTreeItems(methods: readonly Method[]): MethodTreeViewItem[] {
  return methods.map((method) => {
    const newMethod: MethodTreeViewItem = {
      method,
      children: [],
    };

    newMethod.children = method.usages.map((usage) => ({
      method,
      usage,
      // This needs to be a reference to the parent method, not a copy of it.
      parent: newMethod,
    }));

    return newMethod;
  });
}
