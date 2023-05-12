import * as vscode from "vscode";
import { QueryNode } from "./query-node";

export class QueryTreeViewItem extends vscode.TreeItem {
  constructor(
    public readonly queryNode: QueryNode | undefined,
    public readonly label: string,
    public readonly tooltip: string | undefined,
    public readonly children: QueryTreeViewItem[],
  ) {
    super(label);
  }
}
