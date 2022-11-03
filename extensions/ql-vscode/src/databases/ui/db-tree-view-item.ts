import * as vscode from 'vscode';
import { DbItem } from '../db-item';

/**
 * Represents an item in the database tree view.
 */
export class DbTreeViewItem extends vscode.TreeItem {
  constructor(
    public readonly dbItem: DbItem,
    public readonly label: string,
    public readonly tooltip: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly children: DbTreeViewItem[]
  ) {
    super(label, collapsibleState);
  }
}
