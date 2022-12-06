import { window, workspace } from "vscode";
import { commandRunner } from "../../commandRunner";
import { DisposableObject } from "../../pure/disposable-object";
import { DbManager } from "../db-manager";
import { DbTreeDataProvider } from "./db-tree-data-provider";
import { DbTreeViewItem } from "./db-tree-view-item";

export class DbPanel extends DisposableObject {
  private readonly dataProvider: DbTreeDataProvider;

  public constructor(private readonly dbManager: DbManager) {
    super();

    this.dataProvider = new DbTreeDataProvider(dbManager);

    const treeView = window.createTreeView("codeQLDatabasesExperimental", {
      treeDataProvider: this.dataProvider,
      canSelectMany: false,
    });

    this.push(treeView);
  }

  public async initialize(): Promise<void> {
    this.push(
      commandRunner("codeQLDatabasesExperimental.openConfigFile", () =>
        this.openConfigFile(),
      ),
    );
    this.push(
      commandRunner(
        "codeQLDatabasesExperimental.setSelectedItem",
        (treeViewItem: DbTreeViewItem) => this.setSelectedItem(treeViewItem),
      ),
    );
  }

  private async openConfigFile(): Promise<void> {
    const configPath = this.dbManager.getConfigPath();
    const document = await workspace.openTextDocument(configPath);
    await window.showTextDocument(document);
  }

  private async setSelectedItem(treeViewItem: DbTreeViewItem): Promise<void> {
    if (treeViewItem.dbItem === undefined) {
      throw new Error(
        "Not a selectable database item. Please select a valid item.",
      );
    }
    await this.dbManager.setSelectedDbItem(treeViewItem.dbItem);
  }
}
