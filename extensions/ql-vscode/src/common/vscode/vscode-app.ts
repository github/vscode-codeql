import * as vscode from "vscode";
import { VSCodeCredentials } from "./authentication";
import { Disposable } from "../../pure/disposable-object";
import { App, AppMode } from "../app";
import { AppEventEmitter } from "../events";
import { extLogger, Logger, queryServerLogger } from "../logging";
import { Memento } from "../memento";
import { VSCodeAppEventEmitter } from "./events";
import { AppCommandManager, QueryServerCommandManager } from "../commands";
import { createVSCodeCommandManager } from "./commands";

export class ExtensionApp implements App {
  public readonly credentials: VSCodeCredentials;
  public readonly commands: AppCommandManager;
  public readonly queryServerCommands: QueryServerCommandManager;

  public constructor(
    public readonly extensionContext: vscode.ExtensionContext,
  ) {
    this.credentials = new VSCodeCredentials();
    this.commands = createVSCodeCommandManager();
    this.queryServerCommands = createVSCodeCommandManager(queryServerLogger);
    extensionContext.subscriptions.push(this.commands);
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

  public get workspaceState(): Memento {
    return this.extensionContext.workspaceState;
  }

  public get workspaceFolders(): readonly vscode.WorkspaceFolder[] | undefined {
    return vscode.workspace.workspaceFolders;
  }

  public get onDidChangeWorkspaceFolders(): vscode.Event<vscode.WorkspaceFoldersChangeEvent> {
    return vscode.workspace.onDidChangeWorkspaceFolders;
  }

  public get createFileSystemWatcher() {
    return vscode.workspace.createFileSystemWatcher;
  }

  public get subscriptions(): Disposable[] {
    return this.extensionContext.subscriptions;
  }

  public get mode(): AppMode {
    switch (this.extensionContext.extensionMode) {
      case vscode.ExtensionMode.Development:
        return AppMode.Development;
      case vscode.ExtensionMode.Test:
        return AppMode.Test;
      default:
        return AppMode.Production;
    }
  }

  public get logger(): Logger {
    return extLogger;
  }

  public createEventEmitter<T>(): AppEventEmitter<T> {
    return new VSCodeAppEventEmitter<T>();
  }
}
