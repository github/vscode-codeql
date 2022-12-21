import { Disposable } from "../pure/disposable-object";
import { AppEventEmitter } from "./events";
import { Logger } from "./logging";
import { Memento } from "./memento";

export interface App {
  createEventEmitter<T>(): AppEventEmitter<T>;
  executeCommand(command: string, ...args: any): Thenable<void>;
  mode: AppMode;
  logger: Logger;
  subscriptions: Disposable[];
  extensionPath: string;
  globalStoragePath: string;
  workspaceStoragePath?: string;
  workspaceState: Memento;
}

export enum AppMode {
  Production = 1,
  Development = 2,
  Test = 3,
}
