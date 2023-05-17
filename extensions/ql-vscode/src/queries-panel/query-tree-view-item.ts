import * as vscode from "vscode";
import { basename } from "path";

export class QueryTreeViewItem extends vscode.TreeItem {
  constructor(path: string, public readonly children: QueryTreeViewItem[]) {
    super(basename(path));
    this.tooltip = path;
    this.collapsibleState = this.children.length
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;
    if (this.children.length === 0) {
      this.command = {
        title: "Open",
        command: "vscode.open",
        arguments: [vscode.Uri.file(path)],
      };
    }
  }
}
