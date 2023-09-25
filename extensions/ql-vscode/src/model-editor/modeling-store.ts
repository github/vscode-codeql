import { App } from "../common/app";
import { DisposableObject } from "../common/disposable-object";
import { AppEvent, AppEventEmitter } from "../common/events";
import { DatabaseItem } from "../databases/local-databases";
import { Method } from "./method";
import { INITIAL_HIDE_MODELED_METHODS_VALUE } from "./shared/hide-modeled-methods";

interface DbModelingState {
  databaseItem: DatabaseItem;
  methods: Method[];
  hideModeledMethods: boolean;
}

interface MethodsChangedEvent {
  methods: Method[];
  dbUri: string;
  isActiveDb: boolean;
}

interface HideModeledMethodsChangedEvent {
  hideModeledMethods: boolean;
  isActiveDb: boolean;
}

export class ModelingStore extends DisposableObject {
  public readonly onActiveDbChanged: AppEvent<void>;
  public readonly onDbClosed: AppEvent<string>;
  public readonly onMethodsChanged: AppEvent<MethodsChangedEvent>;
  public readonly onHideModeledMethodsChanged: AppEvent<HideModeledMethodsChangedEvent>;

  private readonly state: Map<string, DbModelingState>;
  private activeDb: string | undefined;

  private readonly onActiveDbChangedEventEmitter: AppEventEmitter<void>;
  private readonly onDbClosedEventEmitter: AppEventEmitter<string>;
  private readonly onMethodsChangedEventEmitter: AppEventEmitter<MethodsChangedEvent>;
  private readonly onHideModeledMethodsChangedEventEmitter: AppEventEmitter<HideModeledMethodsChangedEvent>;

  constructor(app: App) {
    super();

    // State initialization
    this.state = new Map<string, DbModelingState>();

    // Event initialization
    this.onActiveDbChangedEventEmitter = this.push(
      app.createEventEmitter<void>(),
    );
    this.onActiveDbChanged = this.onActiveDbChangedEventEmitter.event;

    this.onDbClosedEventEmitter = this.push(app.createEventEmitter<string>());
    this.onDbClosed = this.onDbClosedEventEmitter.event;

    this.onMethodsChangedEventEmitter = this.push(
      app.createEventEmitter<MethodsChangedEvent>(),
    );
    this.onMethodsChanged = this.onMethodsChangedEventEmitter.event;

    this.onHideModeledMethodsChangedEventEmitter = this.push(
      app.createEventEmitter<HideModeledMethodsChangedEvent>(),
    );
    this.onHideModeledMethodsChanged =
      this.onHideModeledMethodsChangedEventEmitter.event;
  }

  public initializeStateForDb(databaseItem: DatabaseItem) {
    const dbUri = databaseItem.databaseUri.toString();
    this.state.set(dbUri, {
      databaseItem,
      methods: [],
      hideModeledMethods: INITIAL_HIDE_MODELED_METHODS_VALUE,
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

  public getStateForActiveDb(): DbModelingState | undefined {
    if (!this.activeDb) {
      return undefined;
    }

    return this.state.get(this.activeDb);
  }

  public setMethods(dbItem: DatabaseItem, methods: Method[]) {
    const dbState = this.getState(dbItem);
    const dbUri = dbItem.databaseUri.toString();

    dbState.methods = methods;

    this.onMethodsChangedEventEmitter.fire({
      methods,
      dbUri,
      isActiveDb: dbUri === this.activeDb,
    });
  }

  public setHideModeledMethods(
    dbItem: DatabaseItem,
    hideModeledMethods: boolean,
  ) {
    const dbState = this.getState(dbItem);
    const dbUri = dbItem.databaseUri.toString();

    dbState.hideModeledMethods = hideModeledMethods;

    this.onHideModeledMethodsChangedEventEmitter.fire({
      hideModeledMethods,
      isActiveDb: dbUri === this.activeDb,
    });
  }

  private getState(databaseItem: DatabaseItem): DbModelingState {
    if (!this.state.has(databaseItem.databaseUri.toString())) {
      throw Error(
        "Cannot get state for a database that has not been initialized",
      );
    }

    return this.state.get(databaseItem.databaseUri.toString())!;
  }
}
