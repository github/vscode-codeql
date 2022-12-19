import { TreeView, TreeViewExpansionEvent, window, workspace } from "vscode";
import { commandRunner } from "../../commandRunner";
import { DisposableObject } from "../../pure/disposable-object";
import { DbItem, DbItemKind } from "../db-item";
import { DbManager } from "../db-manager";
import { DbTreeDataProvider } from "./db-tree-data-provider";
import { DbTreeViewItem } from "./db-tree-view-item";

export class DbPanel extends DisposableObject {
  private readonly dataProvider: DbTreeDataProvider;
  private readonly treeView: TreeView<DbTreeViewItem>;

  public constructor(private readonly dbManager: DbManager) {
    super();

    this.dataProvider = new DbTreeDataProvider(dbManager);

    this.treeView = window.createTreeView("codeQLDatabasesExperimental", {
      treeDataProvider: this.dataProvider,
      canSelectMany: false,
    });

    this.push(
      this.treeView.onDidCollapseElement(async (e) => {
        await this.onDidCollapseElement(e);
      }),
    );
    this.push(
      this.treeView.onDidExpandElement(async (e) => {
        await this.onDidExpandElement(e);
      }),
    );

    this.push(this.treeView);
  }

  public async initialize(): Promise<void> {
    this.push(
      commandRunner("codeQLDatabasesExperimental.openConfigFile", () =>
        this.openConfigFile(),
      ),
    );
    this.push(
      commandRunner("codeQLDatabasesExperimental.addNewList", () =>
        this.addNewRemoteList(),
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

  private async addNewRemoteList(): Promise<void> {
    const listName = await window.showInputBox({
      prompt: "Enter a name for the new list",
      placeHolder: "example-list",
    });
    if (listName === undefined) {
      return;
    }

    const highlightedItem = await this.getHighlightedDbItem();

    const listKind = highlightedItem?.kind || DbItemKind.RootRemote;

    await this.dbManager.addNewList(listKind, listName);
  }

  private async setSelectedItem(treeViewItem: DbTreeViewItem): Promise<void> {
    if (treeViewItem.dbItem === undefined) {
      throw new Error(
        "Not a selectable database item. Please select a valid item.",
      );
    }
    await this.dbManager.setSelectedDbItem(treeViewItem.dbItem);
  }

  private async onDidCollapseElement(
    event: TreeViewExpansionEvent<DbTreeViewItem>,
  ): Promise<void> {
    const dbItem = event.element.dbItem;
    if (!dbItem) {
      throw Error("Expected a database item.");
    }

    await this.dbManager.updateDbItemExpandedState(event.element.dbItem, false);
  }

  private async onDidExpandElement(
    event: TreeViewExpansionEvent<DbTreeViewItem>,
  ): Promise<void> {
    const dbItem = event.element.dbItem;
    if (!dbItem) {
      throw Error("Expected a database item.");
    }

    await this.dbManager.updateDbItemExpandedState(event.element.dbItem, true);
  }

  private async getHighlightedDbItem(): Promise<DbItem | undefined> {
    // You can only select one item at a time, so selection[0] gives the selection
    return this.treeView.selection[0]?.dbItem;
  }
}
