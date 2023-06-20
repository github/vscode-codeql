import * as vscode from "vscode";

export class QueryTreeViewItem extends vscode.TreeItem {
  constructor(
    name: string,
    path: string,
    language: string | undefined,
    public readonly children: QueryTreeViewItem[],
  ) {
    super(name);
    this.tooltip = path;
    if (this.children.length === 0) {
      this.description = language;
      this.collapsibleState = vscode.TreeItemCollapsibleState.None;
      this.contextValue = "queryFile";
      this.command = {
        title: "Open",
        command: "vscode.open",
        arguments: [vscode.Uri.file(path)],
      };
    } else {
      this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    }
  }
}
