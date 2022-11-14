import * as vscode from 'vscode';
import { App } from '../app';
import { AppEventEmitter } from '../events';
import { VSCodeAppEventEmitter } from './events';

export class ExtensionApp implements App {
  public constructor(
    public readonly extensionPath: string,
    public readonly globalStoragePath: string,
    public readonly workspaceStoragePath?: string
  ) {
  }

  public static createFromExtensionContext(extensionContext: vscode.ExtensionContext): ExtensionApp {
    return new ExtensionApp(
      extensionContext.extensionPath,
      extensionContext.globalStorageUri.fsPath,
      extensionContext.storageUri?.fsPath
    );
  }

  public createEventEmitter<T>(): AppEventEmitter<T> {
    return new VSCodeAppEventEmitter<T>();
  }
}
