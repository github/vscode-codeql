import { Credentials } from "./authentication";
import { Disposable } from "../pure/disposable-object";
import { AppEventEmitter } from "./events";
import { Logger } from "./logging";
import { Memento } from "./memento";
import { AppCommandManager } from "./commands";

export interface App {
  createEventEmitter<T>(): AppEventEmitter<T>;
  readonly mode: AppMode;
  readonly logger: Logger;
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
