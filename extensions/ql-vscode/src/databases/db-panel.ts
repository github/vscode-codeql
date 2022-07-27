import * as vscode from 'vscode';
import { DisposableObject } from '../pure/disposable-object';
import { ProviderResult, TreeDataProvider, TreeItem } from 'vscode';
import { DatabaseConfigStore, RemoteRepositoryList } from '../database-config-store';
import { DbItem, RepoDbItem, RootDbItem, SystemDefinedListDbItem, UserDefinedListDbItem } from './db-item';
import { IconProvider } from '../icon-provider';
import { logger } from '../logging';


export class DbPanel extends DisposableObject {
  private dataProvider: CharisDatabaseTreeDataProvider;

  public constructor(
    dbConfigStore: DatabaseConfigStore,
    iconProvider: IconProvider
  ) {
    super();

    this.dataProvider = new CharisDatabaseTreeDataProvider(dbConfigStore, iconProvider);

    // Create tree view
    const treeView = vscode.window.createTreeView('codeQLCharisDatabases', {
      treeDataProvider: this.dataProvider,
      canSelectMany: false
    });

    // Ensure tree view is disposed
    this.push(treeView);
  }
}

export class CharisDatabaseTreeDataProvider extends DisposableObject implements TreeDataProvider<DbItem> {
  private dbTreeItems: DbItem[];

  public constructor(
    private readonly dbConfigStore: DatabaseConfigStore,
    private readonly iconProvider: IconProvider
  ) {
    super();

    this.dbTreeItems = this.createTree();
  }

  // Called when expanding a node (including root)
  public getChildren(element?: DbItem): ProviderResult<DbItem[]> {
    if (!element) {
      // We're at the root.
      return Promise.resolve(this.dbTreeItems);
    } else {
      return Promise.resolve(element.children);
    }
  }

  // Returns the UI presentation of the element that gets displayed in the view.
  public getTreeItem(element: DbItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  private createTree(): DbItem[] {
    void logger.log('Creating database tree');
    const userDefinedRepoLists = this.dbConfigStore.getRemoteRepositoryLists();
    const remoteDbItems = this.createRemoteTree(userDefinedRepoLists);
    return [
      new RootDbItem('local', []),
      new RootDbItem('remote', remoteDbItems)
    ];
  }

  private createRemoteTree(userDefinedRepoLists: RemoteRepositoryList[]): DbItem[] {
    const items: DbItem[] = [];

    // First create system defined lists
    items.push(new SystemDefinedListDbItem('Top 10', 'Top 10 most popular repositories', this.iconProvider));
    items.push(new SystemDefinedListDbItem('Top 100', 'Top 100 most popular repositories', this.iconProvider));
    items.push(new SystemDefinedListDbItem('Top 1000', 'Top 1000 most popular repositories', this.iconProvider));

    // Then add user defined lists
    for (const list of userDefinedRepoLists) {
      const repos = list.repositories.map(repo => new RepoDbItem(repo, 'remote', this.iconProvider));
      items.push(new UserDefinedListDbItem(list.name, 'remote', repos));
    }

    // And then any owners
    // TODO... 

    return items;
  }
}
