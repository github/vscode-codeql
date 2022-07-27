import * as vscode from 'vscode';
import { IconProvider } from '../icon-provider';

// TODO: Consider whether we should merge these two into one to avoid confusion/complexity.
export type DbItemType = 'root' | 'systemDefinedList' | 'userDefinedlist' | 'owner' | 'repo';
export type DbItemLocation = 'local' | 'remote';

export class DbItem extends vscode.TreeItem {
  constructor(
    public readonly type: DbItemType,
    public readonly location: DbItemLocation,
    public readonly label: string,
    public readonly tooltip: string,
    public readonly children: DbItem[],
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }
}

// TODO: Consider merging everything in one class.

export class RootDbItem extends DbItem {
  constructor(
    location: DbItemLocation,
    children: DbItem[]
  ) {
    const label = location === 'local' ? 'local' : 'remote';
    const tooltip = location === 'local' ? 'Local databases' : 'Remote databases';

    super(
      'root',
      location,
      label,
      tooltip,
      children,
      vscode.TreeItemCollapsibleState.Collapsed
    );

    // No icons for root level items.
    this.iconPath = undefined;

    // TODO: Consider what this should be based on actions we want to execute.
    this.contextValue = 'rootDbItem';
  }
}

export class SystemDefinedListDbItem extends DbItem {
  constructor(
    public readonly listName: string,
    public readonly tooltip: string,
    iconProvider: IconProvider
  ) {
    // TODO: Consider whether we need user fiendly and system friendly list names.

    // Only allow remote system defined lists.
    super(
      'systemDefinedList',
      'remote',
      listName,
      tooltip,
      [],
      vscode.TreeItemCollapsibleState.None);

    this.iconPath = iconProvider.getGitHubIconPath();

    this.contextValue = 'dbList';
  }
}

export class UserDefinedListDbItem extends DbItem {
  constructor(
    public readonly listName: string,
    location: DbItemLocation,
    children: DbItem[]
  ) {
    super(
      'userDefinedlist',
      location,
      listName,
      'list of repos defined in settings',
      children,
      vscode.TreeItemCollapsibleState.Collapsed
    );

    this.contextValue = 'dbList';

    // No icons for user defined lists.
  }
}

export class OwnerDbItem extends DbItem {
  constructor(
    public readonly owner: string,
    iconProvider: IconProvider
  ) {
    // Only allow remote owner db items.
    super(
      'owner',
      'remote',
      owner,
      'All repos owned by ' + owner,
      [],
      vscode.TreeItemCollapsibleState.None);

    this.iconPath = iconProvider.getGitHubIconPath();

    this.contextValue = 'dbList';
  }
}

export class RepoDbItem extends DbItem {
  constructor(
    public readonly nwo: string,
    location: DbItemLocation,
    iconProvider: IconProvider
  ) {
    super(
      'repo',
      location,
      nwo,
      nwo,
      [],
      vscode.TreeItemCollapsibleState.None);

    this.iconPath = iconProvider.getCloudIconPath();

    this.contextValue = 'dbItem';
  }
}
