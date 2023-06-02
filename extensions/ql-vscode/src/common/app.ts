import { Credentials } from "./authentication";
import { Disposable } from "../pure/disposable-object";
import { AppEventEmitter } from "./events";
import { Logger } from "./logging";
import { Memento } from "./memento";
import { AppCommandManager } from "./commands";
import type {
  WorkspaceFolder,
  Event,
  WorkspaceFoldersChangeEvent,
} from "vscode";

export interface App {
  createEventEmitter<T>(): AppEventEmitter<T>;
  readonly mode: AppMode;
  readonly logger: Logger;
  readonly subscriptions: Disposable[];
  readonly extensionPath: string;
  readonly globalStoragePath: string;
  readonly workspaceStoragePath?: string;
  readonly workspaceState: Memento;
  readonly workspaceFolders: readonly WorkspaceFolder[] | undefined;
  readonly onDidChangeWorkspaceFolders: Event<WorkspaceFoldersChangeEvent>;
  readonly credentials: Credentials;
  readonly commands: AppCommandManager;
}

export enum AppMode {
  Production = 1,
  Development = 2,
  Test = 3,
}
