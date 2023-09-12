import { TreeView, window } from "vscode";
import { DisposableObject } from "../../common/disposable-object";
import {
  MethodsUsageDataProvider,
  MethodsUsageTreeViewItem,
} from "./methods-usage-data-provider";
import { Method, Usage } from "../method";
import { DatabaseItem } from "../../databases/local-databases";
import { CodeQLCliServer } from "../../codeql-cli/cli";

export class MethodsUsagePanel extends DisposableObject {
  private readonly dataProvider: MethodsUsageDataProvider;
  private readonly treeView: TreeView<MethodsUsageTreeViewItem>;

  public constructor(cliServer: CodeQLCliServer) {
    super();

    this.dataProvider = new MethodsUsageDataProvider(cliServer);

    this.treeView = window.createTreeView("codeQLMethodsUsage", {
      treeDataProvider: this.dataProvider,
    });
    this.push(this.treeView);
  }

  public async setState(
    methods: Method[],
    databaseItem: DatabaseItem,
    hideModeledMethods: boolean,
  ): Promise<void> {
    await this.dataProvider.setState(methods, databaseItem, hideModeledMethods);
    const numOfApis = hideModeledMethods
      ? methods.filter((api) => !api.supported).length
      : methods.length;
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
