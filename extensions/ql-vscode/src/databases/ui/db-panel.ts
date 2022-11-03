import * as vscode from 'vscode';
import { DisposableObject } from '../../pure/disposable-object';
import { DbManager } from '../db-manager';
import { DbTreeDataProvider } from './db-tree-data-provider';

export class DbPanel extends DisposableObject {
  private readonly dataProvider: DbTreeDataProvider;

  public constructor(
    dbManager: DbManager
  ) {
    super();

    this.dataProvider = new DbTreeDataProvider(dbManager);

    const treeView = vscode.window.createTreeView('codeQLDatabasesExperimental', {
      treeDataProvider: this.dataProvider,
      canSelectMany: false
    });

    this.push(treeView);
  }
}
