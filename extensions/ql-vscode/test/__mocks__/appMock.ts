import type { App, EnvironmentContext } from "../../src/common/app";
import { AppMode } from "../../src/common/app";
import type { AppEvent, AppEventEmitter } from "../../src/common/events";
import type { Memento } from "../../src/common/memento";
import { createMockLogger } from "./loggerMock";
import { createMockMemento } from "../mock-memento";
import { testCredentialsWithStub } from "../factories/authentication";
import type { Credentials } from "../../src/common/authentication";
import type { AppCommandManager } from "../../src/common/commands";
import { createMockCommandManager } from "./commandsMock";
import type { NotificationLogger } from "../../src/common/logging";
import type { AppTelemetry } from "../../src/common/telemetry";
import { createMockTelemetryReporter } from "./telemetryMock";

export function createMockApp({
  extensionPath = "/mock/extension/path",
  workspaceStoragePath = "/mock/workspace/storage/path",
  globalStoragePath = "/mock/global/storage/path",
  createEventEmitter = <T>() => new MockAppEventEmitter<T>(),
  workspaceState = createMockMemento(),
  credentials = testCredentialsWithStub(),
  commands = createMockCommandManager(),
  environment = createMockEnvironmentContext(),
  logger = createMockLogger(),
  telemetry = createMockTelemetryReporter(),
}: {
  extensionPath?: string;
  workspaceStoragePath?: string;
  globalStoragePath?: string;
  createEventEmitter?: <T>() => AppEventEmitter<T>;
  workspaceState?: Memento;
  credentials?: Credentials;
  commands?: AppCommandManager;
  environment?: EnvironmentContext;
  logger?: NotificationLogger;
  telemetry?: AppTelemetry;
} = {}): App {
  return {
    mode: AppMode.Test,
    logger,
    telemetry,
    subscriptions: [],
    extensionPath,
    workspaceStoragePath,
    globalStoragePath,
    workspaceState,
    createEventEmitter,
    credentials,
    commands,
    environment,
  };
}

class MockAppEventEmitter<T> implements AppEventEmitter<T> {
  public event: AppEvent<T>;
  private listeners: Array<(event: T) => void> = [];

  constructor() {
    this.event = (listener) => {
      this.listeners.push(listener);
      return {
        dispose: () => {
          this.listeners = this.listeners.filter((l) => l !== listener);
        },
      };
    };
  }

  public fire(event: T): void {
    this.listeners.forEach((listener) => listener(event));
  }

  public dispose() {
    this.listeners = [];
  }
}

function createMockEnvironmentContext(): EnvironmentContext {
  return {
    language: "en-US",
  };
}
