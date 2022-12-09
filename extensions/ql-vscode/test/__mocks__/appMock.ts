import { App, AppMode } from "../../src/common/app";
import { AppEvent, AppEventEmitter } from "../../src/common/events";
import { Disposable } from "../../src/pure/disposable-object";

export function createMockApp({
  extensionPath = "/mock/extension/path",
  workspaceStoragePath = "/mock/workspace/storage/path",
  globalStoragePath = "/mock/global/storage/path",
  createEventEmitter = <T>() => new MockAppEventEmitter<T>(),
  executeCommand = jest.fn(() => Promise.resolve()),
}: {
  extensionPath?: string;
  workspaceStoragePath?: string;
  globalStoragePath?: string;
  createEventEmitter?: <T>() => AppEventEmitter<T>;
  executeCommand?: () => Promise<void>;
}): App {
  return {
    mode: AppMode.Test,
    subscriptions: [],
    extensionPath,
    workspaceStoragePath,
    globalStoragePath,
    createEventEmitter,
    executeCommand,
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
}
