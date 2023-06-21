import * as vscode from "vscode";
import { VSCodeCredentials } from "./authentication";
import { Disposable } from "../disposable-object";
import { App, AppMode, EnvironmentContext } from "../app";
import { AppEventEmitter } from "../events";
import { extLogger, NotificationLogger, queryServerLogger } from "../logging";
import { Memento } from "../memento";
import { VSCodeAppEventEmitter } from "./events";
import { AppCommandManager, QueryServerCommandManager } from "../commands";
import { createVSCodeCommandManager } from "./commands";
import { AppEnvironmentContext } from "./environment-context";
import { AppTelemetry } from "../telemetry";
import { telemetryListener } from "./telemetry";

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

  public get logger(): NotificationLogger {
    return extLogger;
  }

  public get telemetry(): AppTelemetry | undefined {
    return telemetryListener;
  }

  public createEventEmitter<T>(): AppEventEmitter<T> {
    return new VSCodeAppEventEmitter<T>();
  }

  public get environment(): EnvironmentContext {
    return new AppEnvironmentContext();
  }
}
