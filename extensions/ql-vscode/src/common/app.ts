import { Credentials } from "./authentication";
import { Disposable } from "../pure/disposable-object";
import { AppEventEmitter } from "./events";
import { Logger } from "./logging";
import { Memento } from "./memento";
import { JsonValidator } from "../data-serialization/json-validator";

export interface App {
  createEventEmitter<T>(): AppEventEmitter<T>;
  executeCommand(command: string, ...args: any): Thenable<void>;
  readonly mode: AppMode;
  readonly logger: Logger;
  readonly subscriptions: Disposable[];
  readonly extensionPath: string;
  readonly globalStoragePath: string;
  readonly workspaceStoragePath?: string;
  readonly workspaceState: Memento;
  readonly credentials: Credentials;
  readonly jsonValidator: JsonValidator;
}

export enum AppMode {
  Production = 1,
  Development = 2,
  Test = 3,
}
