import { App, AppMode, EnvironmentContext } from "../../src/common/app";
import { AppEvent, AppEventEmitter } from "../../src/common/events";
import { Memento } from "../../src/common/memento";
import { Disposable } from "../../src/pure/disposable-object";
import { createMockLogger } from "./loggerMock";
import { createMockMemento } from "../mock-memento";
import { testCredentialsWithStub } from "../factories/authentication";
import { Credentials } from "../../src/common/authentication";
import { AppCommandManager } from "../../src/common/commands";
import { createMockCommandManager } from "./commandsMock";
import type {
  Event,
  WorkspaceFolder,
  WorkspaceFoldersChangeEvent,
} from "vscode";

export function createMockApp({
  extensionPath = "/mock/extension/path",
  workspaceStoragePath = "/mock/workspace/storage/path",
  globalStoragePath = "/mock/global/storage/path",
  createEventEmitter = <T>() => new MockAppEventEmitter<T>(),
  workspaceState = createMockMemento(),
  workspaceFolders = [],
  onDidChangeWorkspaceFolders = jest.fn(),
  credentials = testCredentialsWithStub(),
  commands = createMockCommandManager(),
  environment = createMockEnvironmentContext(),
}: {
  extensionPath?: string;
  workspaceStoragePath?: string;
  globalStoragePath?: string;
  createEventEmitter?: <T>() => AppEventEmitter<T>;
  workspaceState?: Memento;
  workspaceFolders?: readonly WorkspaceFolder[] | undefined;
  onDidChangeWorkspaceFolders?: Event<WorkspaceFoldersChangeEvent>;
  credentials?: Credentials;
  commands?: AppCommandManager;
  environment?: EnvironmentContext;
}): App {
  return {
    mode: AppMode.Test,
    logger: createMockLogger(),
    subscriptions: [],
    extensionPath,
    workspaceStoragePath,
    globalStoragePath,
    workspaceState,
    workspaceFolders,
    onDidChangeWorkspaceFolders,
    createEventEmitter,
    credentials,
    commands,
    environment,
  };
}

export class MockAppEventEmitter<T> implements AppEventEmitter<T> {
  public event: AppEvent<T>;

  constructor() {
    this.event = () => {
      return {} as Disposable;
    };
  }

  public fire(): void {
    // no-op
  }

  public dispose() {
    // no-op
  }
}

export function createMockEnvironmentContext(): EnvironmentContext {
  return {
    language: "en-US",
  };
}
