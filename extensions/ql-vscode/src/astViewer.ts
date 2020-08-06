import * as vscode from 'vscode';

import { DatabaseItem } from './databases';
import { UrlValue, BqrsId } from './bqrs-cli-types';
import fileRangeFromURI from './contextual/fileRangeFromURI';
import { showLocation } from './interface-utils';
import { isStringLoc, isWholeFileLoc, isLineColumnLoc } from './bqrs-utils';

export interface AstItem {
  id: BqrsId;
  label?: string;
  location?: UrlValue;
  parent: AstItem | RootAstItem;
  children: AstItem[];
  order: number;
}

export type RootAstItem = Omit<AstItem, 'parent'>;

class AstViewerDataProvider implements vscode.TreeDataProvider<AstItem | RootAstItem> {

  public roots: RootAstItem[] = [];
  public db: DatabaseItem | undefined;

  private _onDidChangeTreeData =
    new vscode.EventEmitter<AstItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<AstItem | undefined> =
    this._onDidChangeTreeData.event;

  constructor() {
    vscode.commands.registerCommand('codeQLAstViewer.gotoCode',
      async (location: UrlValue, db: DatabaseItem) => {
        if (location) {
          await showLocation(fileRangeFromURI(location, db));
        }
      });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
  getChildren(item?: AstItem): vscode.ProviderResult<(AstItem | RootAstItem)[]> {
    const children = item ? item.children : this.roots;
    return children.sort((c1, c2) => (c1.order - c2.order));
  }

  getParent(item: AstItem): vscode.ProviderResult<AstItem> {
    return item.parent as AstItem;
  }

  getTreeItem(item: AstItem): vscode.TreeItem {
    const line = this.extractLineInfo(item?.location);

    const state = item.children.length
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;
    const treeItem = new vscode.TreeItem(item.label || '', state);
    treeItem.description = line ? `Line ${line}` : '';
    treeItem.id = String(item.id);
    treeItem.tooltip = `${treeItem.description} ${treeItem.label}`;
    treeItem.command = {
      command: 'codeQLAstViewer.gotoCode',
      title: 'Go To Code',
      tooltip: `Go To ${item.location}`,
      arguments: [item.location, this.db]
    };
    return treeItem;
  }

  private extractLineInfo(loc?: UrlValue) {
    if (!loc) {
      return '';
    } else if (isStringLoc(loc)) {
      return loc;
    } else if (isWholeFileLoc(loc)) {
      return loc.uri;
    } else if (isLineColumnLoc(loc)) {
      return loc.startLine;
    } else {
      return '';
    }
  }
}

export class AstViewer {
  private treeView: vscode.TreeView<AstItem | RootAstItem>;
  private treeDataProvider: AstViewerDataProvider;

  constructor() {
    this.treeDataProvider = new AstViewerDataProvider();
    this.treeView = vscode.window.createTreeView('codeQLAstViewer', {
      treeDataProvider: this.treeDataProvider,
      showCollapseAll: true
    });

    vscode.commands.registerCommand('codeQLAstViewer.clear', () => {
      this.clear();
    });
  }

  updateRoots(roots: RootAstItem[], db: DatabaseItem, fileName: string) {
    this.treeDataProvider.roots = roots;
    this.treeDataProvider.db = db;
    this.treeDataProvider.refresh();
    this.treeView.message = `AST for ${fileName}`;
    this.treeView.reveal(roots[0], { focus: true });
  }

  private clear() {
    this.treeDataProvider.roots = [];
    this.treeDataProvider.db = undefined;
    this.treeDataProvider.refresh();
    this.treeView.message = undefined;
  }
}
