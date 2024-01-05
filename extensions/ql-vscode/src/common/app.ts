import type { Credentials } from "./authentication";
import type { Disposable } from "./disposable-object";
import type { AppEventEmitter } from "./events";
import type { NotificationLogger } from "./logging";
import type { Memento } from "./memento";
import type { AppCommandManager } from "./commands";
import type { AppTelemetry } from "./telemetry";

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
