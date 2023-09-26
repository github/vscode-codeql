import { App } from "../common/app";
import { DisposableObject } from "../common/disposable-object";
import { AppEvent, AppEventEmitter } from "../common/events";
import { DatabaseItem } from "../databases/local-databases";
import { Method } from "./method";
import { ModeledMethod } from "./modeled-method";
import { INITIAL_HIDE_MODELED_METHODS_VALUE } from "./shared/hide-modeled-methods";

interface DbModelingState {
  databaseItem: DatabaseItem;
  methods: Method[];
  hideModeledMethods: boolean;
  modeledMethods: Record<string, ModeledMethod>;
  modifiedMethodSignatures: Set<string>;
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

interface ModeledMethodsChangedEvent {
  modeledMethods: Record<string, ModeledMethod>;
  dbUri: string;
  isActiveDb: boolean;
}

interface ModifiedMethodsChangedEvent {
  modifiedMethods: Set<string>;
  dbUri: string;
  isActiveDb: boolean;
}

export class ModelingStore extends DisposableObject {
  public readonly onActiveDbChanged: AppEvent<void>;
  public readonly onDbClosed: AppEvent<string>;
  public readonly onMethodsChanged: AppEvent<MethodsChangedEvent>;
  public readonly onHideModeledMethodsChanged: AppEvent<HideModeledMethodsChangedEvent>;
  public readonly onModeledMethodsChanged: AppEvent<ModeledMethodsChangedEvent>;
  public readonly onModifiedMethodsChanged: AppEvent<ModifiedMethodsChangedEvent>;

  private readonly state: Map<string, DbModelingState>;
  private activeDb: string | undefined;

  private readonly onActiveDbChangedEventEmitter: AppEventEmitter<void>;
  private readonly onDbClosedEventEmitter: AppEventEmitter<string>;
  private readonly onMethodsChangedEventEmitter: AppEventEmitter<MethodsChangedEvent>;
  private readonly onHideModeledMethodsChangedEventEmitter: AppEventEmitter<HideModeledMethodsChangedEvent>;
  private readonly onModeledMethodsChangedEventEmitter: AppEventEmitter<ModeledMethodsChangedEvent>;
  private readonly onModifiedMethodsChangedEventEmitter: AppEventEmitter<ModifiedMethodsChangedEvent>;

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

    this.onModeledMethodsChangedEventEmitter = this.push(
      app.createEventEmitter<ModeledMethodsChangedEvent>(),
    );
    this.onModeledMethodsChanged =
      this.onModeledMethodsChangedEventEmitter.event;

    this.onModifiedMethodsChangedEventEmitter = this.push(
      app.createEventEmitter<ModifiedMethodsChangedEvent>(),
    );
    this.onModifiedMethodsChanged =
      this.onModifiedMethodsChangedEventEmitter.event;
  }

  public initializeStateForDb(databaseItem: DatabaseItem) {
    const dbUri = databaseItem.databaseUri.toString();
    this.state.set(dbUri, {
      databaseItem,
      methods: [],
      hideModeledMethods: INITIAL_HIDE_MODELED_METHODS_VALUE,
      modeledMethods: {},
      modifiedMethodSignatures: new Set(),
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

  public addModeledMethods(
    dbItem: DatabaseItem,
    methods: Record<string, ModeledMethod>,
  ) {
    this.changeModeledMethods(dbItem, (state) => {
      const newModeledMethods = {
        ...methods,
        ...Object.fromEntries(
          Object.entries(state.modeledMethods).filter(
            ([_, value]) => value.type !== "none",
          ),
        ),
      };
      state.modeledMethods = newModeledMethods;
    });
  }

  public setModeledMethods(
    dbItem: DatabaseItem,
    methods: Record<string, ModeledMethod>,
  ) {
    this.changeModeledMethods(dbItem, (state) => {
      state.modeledMethods = methods;
    });
  }

  public updateModeledMethod(dbItem: DatabaseItem, method: ModeledMethod) {
    this.changeModeledMethods(dbItem, (state) => {
      state.modeledMethods[method.signature] = method;
    });
  }

  public setModifiedMethods(
    dbItem: DatabaseItem,
    methodSignatures: Set<string>,
  ) {
    this.changeModifiedMethods(dbItem, (state) => {
      state.modifiedMethodSignatures = methodSignatures;
    });
  }

  public addModifiedMethods(
    dbItem: DatabaseItem,
    methodSignatures: Iterable<string>,
  ) {
    this.changeModifiedMethods(dbItem, (state) => {
      for (const signature of methodSignatures) {
        state.modifiedMethodSignatures.add(signature);
      }
    });
  }

  public addModifiedMethod(dbItem: DatabaseItem, methodSignature: string) {
    this.addModifiedMethods(dbItem, [methodSignature]);
  }

  public removeModifiedMethods(
    dbItem: DatabaseItem,
    methodSignatures: string[],
  ) {
    this.changeModifiedMethods(dbItem, (state) => {
      methodSignatures.forEach((signature) => {
        state.modifiedMethodSignatures.delete(signature);
      });
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

  private changeModifiedMethods(
    dbItem: DatabaseItem,
    updateState: (state: DbModelingState) => void,
  ) {
    const state = this.getState(dbItem);

    updateState(state);

    this.onModifiedMethodsChangedEventEmitter.fire({
      modifiedMethods: state.modifiedMethodSignatures,
      dbUri: dbItem.databaseUri.toString(),
      isActiveDb: dbItem.databaseUri.toString() === this.activeDb,
    });
  }

  private changeModeledMethods(
    dbItem: DatabaseItem,
    updateState: (state: DbModelingState) => void,
  ) {
    const state = this.getState(dbItem);

    updateState(state);

    this.onModeledMethodsChangedEventEmitter.fire({
      modeledMethods: state.modeledMethods,
      dbUri: dbItem.databaseUri.toString(),
      isActiveDb: dbItem.databaseUri.toString() === this.activeDb,
    });
  }
}
