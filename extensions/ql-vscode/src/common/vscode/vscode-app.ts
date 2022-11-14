import * as vscode from 'vscode';
import { App } from '../app';
import { AppEventEmitter } from '../events';
import { VSCodeAppEventEmitter } from './events';

export class ExtensionApp implements App {
  public constructor(
    public readonly extensionContext: vscode.ExtensionContext
  ) {
  }

  public get extensionPath(): string {
    return this.extensionContext.extensionPath;
  }

  public get globalStoragePath(): string {
    return this.extensionContext.globalStorageUri.fsPath;
  }

  public get workspaceStoragePath(): string | undefined {
    return this.extensionContext.storageUri?.fsPath;
  }

  public createEventEmitter<T>(): AppEventEmitter<T> {
    return new VSCodeAppEventEmitter<T>();
  }
}
