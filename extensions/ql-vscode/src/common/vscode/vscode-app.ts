import type { ExtensionContext } from "vscode";
import { ExtensionMode } from "vscode";
import { VSCodeCredentials } from "./authentication";
import type { Disposable } from "../disposable-object";
import type { App, EnvironmentContext } from "../app";
import { AppMode } from "../app";
import type { AppEventEmitter } from "../events";
import type { NotificationLogger } from "../logging";
import { extLogger, queryServerLogger } from "../logging/vscode";
import type { Memento } from "../memento";
import { VSCodeAppEventEmitter } from "./events";
import type { AppCommandManager, QueryServerCommandManager } from "../commands";
import { createVSCodeCommandManager } from "./commands";
import { AppEnvironmentContext } from "./environment-context";
import type { AppTelemetry } from "../telemetry";
import { telemetryListener } from "./telemetry";

export class ExtensionApp implements App {
  public readonly credentials: VSCodeCredentials;
  public readonly commands: AppCommandManager;
  public readonly queryServerCommands: QueryServerCommandManager;

  public constructor(public readonly extensionContext: ExtensionContext) {
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
      case ExtensionMode.Development:
        return AppMode.Development;
      case ExtensionMode.Test:
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
