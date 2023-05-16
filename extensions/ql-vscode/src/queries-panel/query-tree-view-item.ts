import * as vscode from "vscode";

export class QueryTreeViewItem extends vscode.TreeItem {
  constructor(
    label: string,
    tooltip: string | undefined,
    public readonly children: QueryTreeViewItem[],
  ) {
    super(label);
    this.tooltip = tooltip;
    this.collapsibleState = this.children.length
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;
  }
}
