import { TreeView, window } from "vscode";
import { DisposableObject } from "../../common/disposable-object";
import {
  ModelDetailsDataProvider,
  ModelDetailsTreeViewItem,
} from "./model-details-data-provider";
import { ExternalApiUsage, Usage } from "../external-api-usage";
import { DatabaseItem } from "../../databases/local-databases";
import { CodeQLCliServer } from "../../codeql-cli/cli";

export class ModelDetailsPanel extends DisposableObject {
  private readonly dataProvider: ModelDetailsDataProvider;
  private readonly treeView: TreeView<ModelDetailsTreeViewItem>;

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
    hideModeledApis: boolean,
  ): Promise<void> {
    await this.dataProvider.setState(
      externalApiUsages,
      databaseItem,
      hideModeledApis,
    );
    const numOfApis = hideModeledApis
      ? externalApiUsages.filter((api) => !api.supported).length
      : externalApiUsages.length;
    this.treeView.badge = {
      value: numOfApis,
      tooltip: "Number of external APIs",
    };
  }

  public async revealItem(usage: Usage): Promise<void> {
    const canonicalUsage = this.dataProvider.resolveCanonicalUsage(usage);
    if (canonicalUsage !== undefined) {
      await this.treeView.reveal(canonicalUsage);
    }
  }
}
