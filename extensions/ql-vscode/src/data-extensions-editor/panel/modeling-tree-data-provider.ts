import {
  Event,
  EventEmitter,
  ProviderResult,
  TreeDataProvider,
  TreeItem,
} from "vscode";

import { DisposableObject } from "../../common/disposable-object";

import { ExternalApiUsageProvider } from "./external-api-usage-provider";
import {
  MethodModelingTreeItem,
  ModelingTreeItem,
  UsageModelingTreeItem,
} from "./modeling-tree-item";

export class ModelingTreeDataProvider
  extends DisposableObject
  implements TreeDataProvider<ModelingTreeItem>
{
  private items: ModelingTreeItem[] = [];

  private _onDidChangeTreeData = this.push(
    new EventEmitter<ModelingTreeItem | undefined>(),
  );

  public constructor(private readonly provider: ExternalApiUsageProvider) {
    super();

    this.push(
      this.provider.onDidChangeExternalApiUsages(
        this.updateExternalApiUsages.bind(this),
      ),
    );

    this.updateExternalApiUsages();
  }

  private updateExternalApiUsages() {
    this.items = this.provider.externalApiUsages.map(
      (method) =>
        new MethodModelingTreeItem(
          method,
          method.usages.map(
            (usage) => new UsageModelingTreeItem(method, usage),
          ),
        ),
    );
    this.items.sort(
      (a, b) =>
        a.resourceUri
          ?.toString()
          .localeCompare(b.resourceUri?.toString() ?? "") ?? 0,
    );
    this._onDidChangeTreeData.fire(undefined);
  }

  public get onDidChangeTreeData(): Event<ModelingTreeItem | undefined> {
    return this._onDidChangeTreeData.event;
  }

  getChildren(node?: ModelingTreeItem): ProviderResult<ModelingTreeItem[]> {
    if (!node) {
      // At root level, return all items
      return this.items;
    }

    return node.children;
  }

  async getTreeItem(node: ModelingTreeItem): Promise<TreeItem> {
    return node;
  }
}
