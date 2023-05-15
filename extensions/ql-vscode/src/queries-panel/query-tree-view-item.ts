import * as vscode from "vscode";

export class QueryTreeViewItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly tooltip: string | undefined,
    public readonly children: QueryTreeViewItem[],
  ) {
    super(label);
  }
}
