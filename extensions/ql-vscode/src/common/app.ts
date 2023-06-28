import { Credentials } from "./authentication";
import { Disposable } from "./disposable-object";
import { AppEventEmitter } from "./events";
import { NotificationLogger } from "./logging";
import { Memento } from "./memento";
import { AppCommandManager } from "./commands";
import { AppTelemetry } from "./telemetry";

export interface App {
  createEventEmitter<T>(): AppEventEmitter<T>;
  readonly mode: AppMode;
  readonly logger: NotificationLogger;
  readonly telemetry?: AppTelemetry;
  readonly subscriptions: Disposable[];
  readonly extensionPath: string;
  readonly globalStoragePath: string;
  readonly workspaceStoragePath?: string;
  readonly workspaceState: Memento;
  readonly credentials: Credentials;
  readonly commands: AppCommandManager;
  readonly environment: EnvironmentContext;
}

export enum AppMode {
  Production = 1,
  Development = 2,
  Test = 3,
}

export interface EnvironmentContext {
  language: string;
}
