import { App } from "../common/app";
import { DisposableObject } from "../common/disposable-object";
import { AppEvent, AppEventEmitter } from "../common/events";
import { DatabaseItem } from "../databases/local-databases";
import { Method, Usage } from "./method";
import { ModeledMethod } from "./modeled-method";
import { INITIAL_HIDE_MODELED_METHODS_VALUE } from "./shared/hide-modeled-methods";

export interface DbModelingState {
  databaseItem: DatabaseItem;
  methods: Method[];
  hideModeledMethods: boolean;
  modeledMethods: Record<string, ModeledMethod[]>;
  modifiedMethodSignatures: Set<string>;
  selectedMethod: Method | undefined;
  selectedUsage: Usage | undefined;
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
  modeledMethods: Record<string, ModeledMethod[]>;
  dbUri: string;
  isActiveDb: boolean;
}

interface ModifiedMethodsChangedEvent {
  modifiedMethods: Set<string>;
  dbUri: string;
  isActiveDb: boolean;
}

interface SelectedMethodChangedEvent {
  databaseItem: DatabaseItem;
  method: Method;
  usage: Usage;
  modeledMethods: ModeledMethod[];
  isModified: boolean;
}

export class ModelingStore extends DisposableObject {
  public readonly onActiveDbChanged: AppEvent<void>;
  public readonly onDbOpened: AppEvent<string>;
  public readonly onDbClosed: AppEvent<string>;
  public readonly onMethodsChanged: AppEvent<MethodsChangedEvent>;
  public readonly onHideModeledMethodsChanged: AppEvent<HideModeledMethodsChangedEvent>;
  public readonly onModeledMethodsChanged: AppEvent<ModeledMethodsChangedEvent>;
  public readonly onModifiedMethodsChanged: AppEvent<ModifiedMethodsChangedEvent>;
  public readonly onSelectedMethodChanged: AppEvent<SelectedMethodChangedEvent>;

  private readonly state: Map<string, DbModelingState>;
  private activeDb: string | undefined;

  private readonly onActiveDbChangedEventEmitter: AppEventEmitter<void>;
  private readonly onDbOpenedEventEmitter: AppEventEmitter<string>;
  private readonly onDbClosedEventEmitter: AppEventEmitter<string>;
  private readonly onMethodsChangedEventEmitter: AppEventEmitter<MethodsChangedEvent>;
  private readonly onHideModeledMethodsChangedEventEmitter: AppEventEmitter<HideModeledMethodsChangedEvent>;
  private readonly onModeledMethodsChangedEventEmitter: AppEventEmitter<ModeledMethodsChangedEvent>;
  private readonly onModifiedMethodsChangedEventEmitter: AppEventEmitter<ModifiedMethodsChangedEvent>;
  private readonly onSelectedMethodChangedEventEmitter: AppEventEmitter<SelectedMethodChangedEvent>;

  constructor(app: App) {
    super();

    // State initialization
    this.state = new Map<string, DbModelingState>();

    // Event initialization
    this.onActiveDbChangedEventEmitter = this.push(
      app.createEventEmitter<void>(),
    );
    this.onActiveDbChanged = this.onActiveDbChangedEventEmitter.event;

    this.onDbOpenedEventEmitter = this.push(app.createEventEmitter<string>());
    this.onDbOpened = this.onDbOpenedEventEmitter.event;

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

    this.onSelectedMethodChangedEventEmitter = this.push(
      app.createEventEmitter<SelectedMethodChangedEvent>(),
    );
    this.onSelectedMethodChanged =
      this.onSelectedMethodChangedEventEmitter.event;
  }

  public initializeStateForDb(databaseItem: DatabaseItem) {
    const dbUri = databaseItem.databaseUri.toString();
    this.state.set(dbUri, {
      databaseItem,
      methods: [],
      hideModeledMethods: INITIAL_HIDE_MODELED_METHODS_VALUE,
      modeledMethods: {},
      modifiedMethodSignatures: new Set(),
      selectedMethod: undefined,
      selectedUsage: undefined,
    });

    this.onDbOpenedEventEmitter.fire(dbUri);
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

  public hasStateForActiveDb(): boolean {
    return !!this.getStateForActiveDb();
  }

  public anyDbsBeingModeled(): boolean {
    return this.state.size > 0;
  }

  public setMethods(dbItem: DatabaseItem, methods: Method[]) {
    const dbState = this.getState(dbItem);
    const dbUri = dbItem.databaseUri.toString();

    dbState.methods = [...methods];

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
    methods: Record<string, ModeledMethod[]>,
  ) {
    this.changeModeledMethods(dbItem, (state) => {
      const newModeledMethods = {
        ...methods,
        // Keep all methods that are already modeled in some form in the state
        ...Object.fromEntries(
          Object.entries(state.modeledMethods).filter(([_, value]) =>
            value.some((m) => m.type !== "none"),
          ),
        ),
      };
      state.modeledMethods = newModeledMethods;
    });
  }

  public setModeledMethods(
    dbItem: DatabaseItem,
    methods: Record<string, ModeledMethod[]>,
  ) {
    this.changeModeledMethods(dbItem, (state) => {
      state.modeledMethods = { ...methods };
    });
  }

  public updateModeledMethods(
    dbItem: DatabaseItem,
    signature: string,
    modeledMethods: ModeledMethod[],
  ) {
    this.changeModeledMethods(dbItem, (state) => {
      const newModeledMethods = { ...state.modeledMethods };
      newModeledMethods[signature] = modeledMethods;
      state.modeledMethods = newModeledMethods;
    });
  }

  public setModifiedMethods(
    dbItem: DatabaseItem,
    methodSignatures: Set<string>,
  ) {
    this.changeModifiedMethods(dbItem, (state) => {
      state.modifiedMethodSignatures = new Set(methodSignatures);
    });
  }

  public addModifiedMethods(
    dbItem: DatabaseItem,
    methodSignatures: Iterable<string>,
  ) {
    this.changeModifiedMethods(dbItem, (state) => {
      const newModifiedMethods = new Set([
        ...state.modifiedMethodSignatures,
        ...methodSignatures,
      ]);
      state.modifiedMethodSignatures = newModifiedMethods;
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
      const newModifiedMethods = Array.from(
        state.modifiedMethodSignatures,
      ).filter((s) => !methodSignatures.includes(s));

      state.modifiedMethodSignatures = new Set(newModifiedMethods);
    });
  }

  public setSelectedMethod(dbItem: DatabaseItem, method: Method, usage: Usage) {
    const dbState = this.getState(dbItem);

    dbState.selectedMethod = method;
    dbState.selectedUsage = usage;

    this.onSelectedMethodChangedEventEmitter.fire({
      databaseItem: dbItem,
      method,
      usage,
      modeledMethods: dbState.modeledMethods[method.signature],
      isModified: dbState.modifiedMethodSignatures.has(method.signature),
    });
  }

  public getSelectedMethodDetails() {
    const dbState = this.getStateForActiveDb();
    if (!dbState) {
      throw new Error("No active state found in modeling store");
    }

    const selectedMethod = dbState.selectedMethod;
    if (!selectedMethod) {
      return undefined;
    }

    return {
      method: selectedMethod,
      usage: dbState.selectedUsage,
      modeledMethods: dbState.modeledMethods[selectedMethod.signature],
      isModified: dbState.modifiedMethodSignatures.has(
        selectedMethod.signature,
      ),
    };
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
