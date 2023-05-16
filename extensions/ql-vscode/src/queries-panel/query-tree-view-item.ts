import * as vscode from "vscode";

export class QueryTreeViewItem extends vscode.TreeItem {
  public collapsibleState: vscode.TreeItemCollapsibleState;
  constructor(
    public readonly label: string,
    public readonly tooltip: string | undefined,
    public readonly children: QueryTreeViewItem[],
  ) {
    super(label);
    this.collapsibleState = this.children.length
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;
  }
}
