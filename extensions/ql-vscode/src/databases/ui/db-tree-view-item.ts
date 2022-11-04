import * as vscode from 'vscode';
import { DbItem } from '../db-item';

/**
 * Represents an item in the database tree view. This item could be 
 * representing an actual database item or an error.
 */
export class DbTreeViewItem extends vscode.TreeItem {
  constructor(
    public readonly dbItem: DbItem | undefined,
    public readonly iconPath: vscode.ThemeIcon,
    public readonly label: string,
    public readonly tooltip: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly children: DbTreeViewItem[]
  ) {
    super(label, collapsibleState);
  }
}

export function createDbTreeViewItemWarning(label: string, tooltip: string): DbTreeViewItem {
  return new DbTreeViewItem(
    undefined,
    new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground')),
    label,
    tooltip,
    vscode.TreeItemCollapsibleState.None,
    []
  );
}
