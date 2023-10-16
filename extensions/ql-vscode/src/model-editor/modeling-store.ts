import { App } from "../common/app";
import { DisposableObject } from "../common/disposable-object";
import { AppEvent, AppEventEmitter } from "../common/events";
import { DatabaseItem } from "../databases/local-databases";
import { Method, Usage } from "./method";
import { ModeledMethod } from "./modeled-method";
import { INITIAL_HIDE_MODELED_METHODS_VALUE } from "./shared/hide-modeled-methods";
import { InProgressMethods } from "./shared/in-progress-methods";
import { INITIAL_MODE, Mode } from "./shared/mode";

interface InternalDbModelingState {
  databaseItem: DatabaseItem;
  methods: Method[];
  hideModeledMethods: boolean;
  mode: Mode;
  modeledMethods: Record<string, ModeledMethod[]>;
  modifiedMethodSignatures: Set<string>;
  inProgressMethods: InProgressMethods;
  selectedMethod: Method | undefined;
  selectedUsage: Usage | undefined;
}

interface DbModelingState {
  readonly databaseItem: DatabaseItem;
  readonly methods: readonly Method[];
  readonly hideModeledMethods: boolean;
  readonly mode: Mode;
  readonly modeledMethods: Readonly<Record<string, readonly ModeledMethod[]>>;
  readonly modifiedMethodSignatures: ReadonlySet<string>;
  readonly selectedMethod: Method | undefined;
  readonly selectedUsage: Usage | undefined;
}

interface SelectedMethodDetails {
  readonly databaseItem: DatabaseItem;
  readonly method: Method;
  readonly usage: Usage | undefined;
  readonly modeledMethods: readonly ModeledMethod[];
  readonly isModified: boolean;
}

interface MethodsChangedEvent {
  readonly methods: readonly Method[];
  readonly dbUri: string;
  readonly isActiveDb: boolean;
}

interface HideModeledMethodsChangedEvent {
  readonly hideModeledMethods: boolean;
  readonly isActiveDb: boolean;
}

interface ModeChangedEvent {
  readonly mode: Mode;
  readonly isActiveDb: boolean;
}

interface ModeledMethodsChangedEvent {
  readonly modeledMethods: Readonly<Record<string, ModeledMethod[]>>;
  readonly dbUri: string;
  readonly isActiveDb: boolean;
}

interface ModifiedMethodsChangedEvent {
  readonly modifiedMethods: ReadonlySet<string>;
  readonly dbUri: string;
  readonly isActiveDb: boolean;
}

interface SelectedMethodChangedEvent {
  readonly databaseItem: DatabaseItem;
  readonly method: Method;
  readonly usage: Usage;
  readonly modeledMethods: readonly ModeledMethod[];
  readonly isModified: boolean;
}

interface InProgressMethodsChangedEvent {
  readonly dbUri: string;
  readonly methods: InProgressMethods;
}

export class ModelingStore extends DisposableObject {
  public readonly onActiveDbChanged: AppEvent<void>;
  public readonly onDbOpened: AppEvent<string>;
  public readonly onDbClosed: AppEvent<string>;
  public readonly onMethodsChanged: AppEvent<MethodsChangedEvent>;
  public readonly onHideModeledMethodsChanged: AppEvent<HideModeledMethodsChangedEvent>;
  public readonly onModeChanged: AppEvent<ModeChangedEvent>;
  public readonly onModeledMethodsChanged: AppEvent<ModeledMethodsChangedEvent>;
  public readonly onModifiedMethodsChanged: AppEvent<ModifiedMethodsChangedEvent>;
  public readonly onSelectedMethodChanged: AppEvent<SelectedMethodChangedEvent>;
  public readonly onInProgressMethodsChanged: AppEvent<InProgressMethodsChangedEvent>;

  private readonly state: Map<string, InternalDbModelingState>;
  private activeDb: string | undefined;

  private readonly onActiveDbChangedEventEmitter: AppEventEmitter<void>;
  private readonly onDbOpenedEventEmitter: AppEventEmitter<string>;
  private readonly onDbClosedEventEmitter: AppEventEmitter<string>;
  private readonly onMethodsChangedEventEmitter: AppEventEmitter<MethodsChangedEvent>;
  private readonly onHideModeledMethodsChangedEventEmitter: AppEventEmitter<HideModeledMethodsChangedEvent>;
  private readonly onModeChangedEventEmitter: AppEventEmitter<ModeChangedEvent>;
  private readonly onModeledMethodsChangedEventEmitter: AppEventEmitter<ModeledMethodsChangedEvent>;
  private readonly onModifiedMethodsChangedEventEmitter: AppEventEmitter<ModifiedMethodsChangedEvent>;
  private readonly onSelectedMethodChangedEventEmitter: AppEventEmitter<SelectedMethodChangedEvent>;
  private readonly onInProgressMethodsChangedEventEmitter: AppEventEmitter<InProgressMethodsChangedEvent>;

  constructor(app: App) {
    super();

    // State initialization
    this.state = new Map<string, InternalDbModelingState>();

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

    this.onModeChangedEventEmitter = this.push(
      app.createEventEmitter<ModeChangedEvent>(),
    );
    this.onModeChanged = this.onModeChangedEventEmitter.event;

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

    this.onInProgressMethodsChangedEventEmitter = this.push(
      app.createEventEmitter<InProgressMethodsChangedEvent>(),
    );
    this.onInProgressMethodsChanged =
      this.onInProgressMethodsChangedEventEmitter.event;
  }

  public initializeStateForDb(
    databaseItem: DatabaseItem,
    mode: Mode = INITIAL_MODE,
  ) {
    const dbUri = databaseItem.databaseUri.toString();
    this.state.set(dbUri, {
      databaseItem,
      methods: [],
      hideModeledMethods: INITIAL_HIDE_MODELED_METHODS_VALUE,
      mode,
      modeledMethods: {},
      modifiedMethodSignatures: new Set(),
      selectedMethod: undefined,
      selectedUsage: undefined,
      inProgressMethods: {},
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

  private getInternalStateForActiveDb(): InternalDbModelingState | undefined {
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

  /**
   * Returns the method for the given database item and method signature.
   * Returns undefined if no method exists with that signature.
   */
  public getMethod(
    dbItem: DatabaseItem,
    methodSignature: string,
  ): Method | undefined {
    return this.getState(dbItem).methods.find(
      (m) => m.signature === methodSignature,
    );
  }

  /**
   * Returns the methods for the given database item and method signatures.
   * If the `methodSignatures` argument is not provided or is undefined, returns all methods.
   */
  public getMethods(
    dbItem: DatabaseItem,
    methodSignatures?: string[],
  ): readonly Method[] {
    const methods = this.getState(dbItem).methods;
    if (!methodSignatures) {
      return methods;
    }
    return methods.filter((method) =>
      methodSignatures.includes(method.signature),
    );
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

  public setMode(dbItem: DatabaseItem, mode: Mode) {
    const dbState = this.getState(dbItem);
    const dbUri = dbItem.databaseUri.toString();

    dbState.mode = mode;

    this.onModeChangedEventEmitter.fire({
      mode,
      isActiveDb: dbUri === this.activeDb,
    });
  }

  public getMode(dbItem: DatabaseItem) {
    return this.getState(dbItem).mode;
  }

  /**
   * Returns the modeled methods for the given database item and method signatures.
   * If the `methodSignatures` argument is not provided or is undefined, returns all modeled methods.
   */
  public getModeledMethods(
    dbItem: DatabaseItem,
    methodSignatures?: string[],
  ): Readonly<Record<string, readonly ModeledMethod[]>> {
    const modeledMethods = this.getState(dbItem).modeledMethods;
    if (!methodSignatures) {
      return modeledMethods;
    }
    return Object.fromEntries(
      Object.entries(modeledMethods).filter(([key]) =>
        methodSignatures.includes(key),
      ),
    );
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

  /**
   * Sets which method is considered to be selected. This method will be shown in the method modeling panel.
   *
   * The `Method` and `Usage` objects must have been retrieved from the modeling store, and not from
   * a webview. This is because we rely on object referential identity so it must be the same object
   * that is held internally by the modeling store.
   */
  public setSelectedMethod(dbItem: DatabaseItem, method: Method, usage: Usage) {
    const dbState = this.getState(dbItem);

    dbState.selectedMethod = method;
    dbState.selectedUsage = usage;

    this.onSelectedMethodChangedEventEmitter.fire({
      databaseItem: dbItem,
      method,
      usage,
      modeledMethods: dbState.modeledMethods[method.signature] ?? [],
      isModified: dbState.modifiedMethodSignatures.has(method.signature),
    });
  }

  public setInProgressMethods(
    dbItem: DatabaseItem,
    packageName: string,
    inProgressMethods: string[],
  ) {
    const dbState = this.getState(dbItem);

    dbState.inProgressMethods = {
      ...dbState.inProgressMethods,
      [packageName]: inProgressMethods,
    };

    this.onInProgressMethodsChangedEventEmitter.fire({
      dbUri: dbItem.databaseUri.toString(),
      methods: dbState.inProgressMethods,
    });
  }

  public getSelectedMethodDetails(): SelectedMethodDetails | undefined {
    const dbState = this.getInternalStateForActiveDb();
    if (!dbState) {
      throw new Error("No active state found in modeling store");
    }

    const selectedMethod = dbState.selectedMethod;
    if (!selectedMethod) {
      return undefined;
    }

    return {
      databaseItem: dbState.databaseItem,
      method: selectedMethod,
      usage: dbState.selectedUsage,
      modeledMethods: dbState.modeledMethods[selectedMethod.signature] ?? [],
      isModified: dbState.modifiedMethodSignatures.has(
        selectedMethod.signature,
      ),
    };
  }

  private getState(databaseItem: DatabaseItem): InternalDbModelingState {
    if (!this.state.has(databaseItem.databaseUri.toString())) {
      throw Error(
        "Cannot get state for a database that has not been initialized",
      );
    }

    return this.state.get(databaseItem.databaseUri.toString())!;
  }

  private changeModifiedMethods(
    dbItem: DatabaseItem,
    updateState: (state: InternalDbModelingState) => void,
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
    updateState: (state: InternalDbModelingState) => void,
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
