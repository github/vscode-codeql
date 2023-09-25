import { App } from "../common/app";
import { DisposableObject } from "../common/disposable-object";
import { AppEvent, AppEventEmitter } from "../common/events";
import { DatabaseItem } from "../databases/local-databases";

interface DbModelingState {
  // Currently empty but will soon contain information about methods, etc.
}

export class ModelingStore extends DisposableObject {
  public readonly onActiveDbChanged: AppEvent<void>;
  public readonly onDbClosed: AppEvent<string>;

  private state: Map<string, DbModelingState>;
  private activeDb: string | undefined;

  private readonly onActiveDbChangedEventEmitter: AppEventEmitter<void>;
  private readonly onDbClosedEventEmitter: AppEventEmitter<string>;

  constructor(app: App) {
    super();

    // State initialization
    this.activeDb = undefined;
    this.state = new Map<string, DbModelingState>();

    // Event initialization
    this.onActiveDbChangedEventEmitter = this.push(
      app.createEventEmitter<void>(),
    );
    this.onActiveDbChanged = this.onActiveDbChangedEventEmitter.event;

    this.onDbClosedEventEmitter = this.push(app.createEventEmitter<string>());
    this.onDbClosed = this.onDbClosedEventEmitter.event;
  }

  public initializeStateForDb(databaseItem: DatabaseItem) {
    const dbUri = databaseItem.databaseUri.toString();
    this.state.set(dbUri, {
      databaseItem,
    });
  }

  public setActiveDb(databaseItem: DatabaseItem) {
    this.activeDb = databaseItem.databaseUri.toString();
    this.onActiveDbChangedEventEmitter.fire();
  }

  public removeDb(databaseItem: DatabaseItem) {
    const dbUri = databaseItem.databaseUri.toString();

    if (!this.state.has(dbUri)) {
      throw Error("Cannot remove a database that has not been initialized");
    }

    if (this.activeDb === dbUri) {
      this.activeDb = undefined;
      this.onActiveDbChangedEventEmitter.fire();
    }

    this.state.delete(dbUri);
    this.onDbClosedEventEmitter.fire(dbUri);
  }
}
