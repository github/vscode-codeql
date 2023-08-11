import { TreeView, window } from "vscode";
import { DisposableObject } from "../../common/disposable-object";
import { ModelDetailsDataProvider } from "./model-details-data-provider";
import { DatabaseItem } from "../../databases/local-databases";
import { ExternalApiUsage, Usage } from "../external-api-usage";
import { CodeQLCliServer } from "../../codeql-cli/cli";

export class ModelDetailsPanel extends DisposableObject {
  private readonly dataProvider: ModelDetailsDataProvider;
  private readonly treeView: TreeView<ExternalApiUsage | Usage>;

  public constructor(cliServer: CodeQLCliServer) {
    super();

    this.dataProvider = new ModelDetailsDataProvider(cliServer);

    this.treeView = window.createTreeView("codeQLModelDetails", {
      treeDataProvider: this.dataProvider,
    });
    this.push(this.treeView);
  }

  public async setState(
    externalApiUsages: ExternalApiUsage[],
    databaseItem: DatabaseItem,
  ): Promise<void> {
    await this.dataProvider.setState(externalApiUsages, databaseItem);
    this.treeView.badge = {
      value: externalApiUsages.length,
      tooltip: "Number of external APIs",
    };
  }
}
