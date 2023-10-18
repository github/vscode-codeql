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
import { INITIAL_HIDE_MODELED_METHODS_VALUE } from "../shared/hide-modeled-methods";
import { getModelingStatus } from "../shared/modeling-status";
import { assertNever } from "../../common/helpers-pure";
import { ModeledMethod } from "../modeled-method";
import { groupMethods, sortGroupNames, sortMethods } from "../shared/sorting";
import { INITIAL_MODE, Mode } from "../shared/mode";

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
      this.sortedTreeItems = createTreeItems(
        sortMethodsInGroups(methods, mode),
      );
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

      return {
        label: usage.label,
        description: `${this.relativePathWithinDatabase(usage.url.uri)} [${
          usage.url.startLine
        }, ${usage.url.endLine}]`,
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
        return this.sortedTreeItems.filter((api) => !api.method.supported);
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
    u1.url.uri === u2.url.uri &&
    u1.url.startLine === u2.url.startLine &&
    u1.url.startColumn === u2.url.startColumn &&
    u1.url.endLine === u2.url.endLine &&
    u1.url.endColumn === u2.url.endColumn
  );
}

function sortMethodsInGroups(methods: readonly Method[], mode: Mode): Method[] {
  const grouped = groupMethods(methods, mode);

  const sortedGroupNames = sortGroupNames(grouped);

  return sortedGroupNames.flatMap((groupName) => {
    const group = grouped[groupName];

    return sortMethods(group);
  });
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
