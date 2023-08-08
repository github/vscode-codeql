import { window } from "vscode";
import { DisposableObject } from "../../common/disposable-object";
import { ModelDetailsDataProvider } from "./model-details-data-provider";
import { ExternalApiUsage } from "../external-api-usage";
import { DatabaseItem } from "../../databases/local-databases";

export class ModelDetailsPanel extends DisposableObject {
  private readonly dataProvider: ModelDetailsDataProvider;

  public constructor() {
    super();

    this.dataProvider = new ModelDetailsDataProvider();

    const treeView = window.createTreeView("codeQLModelDetails", {
      treeDataProvider: this.dataProvider,
    });
    this.push(treeView);
  }

  public setState(
    externalApiUsages: ExternalApiUsage[],
    databaseItem: DatabaseItem,
  ): void {
    this.dataProvider.setState(externalApiUsages, databaseItem);
  }
}
