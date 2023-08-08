import { TreeView, window } from "vscode";
import { DisposableObject } from "../../common/disposable-object";
import {
  ModelDetailsDataProvider,
  ModelDetailsTreeViewItem,
} from "./model-details-data-provider";
import { ExternalApiUsage, Usage } from "../external-api-usage";
import { DatabaseItem } from "../../databases/local-databases";

export class ModelDetailsPanel extends DisposableObject {
  private readonly dataProvider: ModelDetailsDataProvider;
  private readonly treeView: TreeView<ModelDetailsTreeViewItem>;

  public constructor() {
    super();

    this.dataProvider = new ModelDetailsDataProvider();

    this.treeView = window.createTreeView("codeQLModelDetails", {
      treeDataProvider: this.dataProvider,
    });
    this.push(this.treeView);
  }

  public setState(
    externalApiUsages: ExternalApiUsage[],
    databaseItem: DatabaseItem,
  ): void {
    this.dataProvider.setState(externalApiUsages, databaseItem);
  }

  public async revealItem(usage: Usage): Promise<void> {
    const canonicalUsage = this.dataProvider.resolveCanonicalUsage(usage);
    if (canonicalUsage !== undefined) {
      await this.treeView.reveal(canonicalUsage);
    }
  }
}
