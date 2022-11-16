import { Disposable } from "../pure/disposable-object";
import { AppEventEmitter } from "./events";

export interface App {
  createEventEmitter<T>(): AppEventEmitter<T>;
  mode: AppMode;
  subscriptions: Disposable[];
  extensionPath: string;
  globalStoragePath: string;
  workspaceStoragePath?: string;
}

export enum AppMode {
  Production = 1,
  Development = 2,
  Test = 3,
}
