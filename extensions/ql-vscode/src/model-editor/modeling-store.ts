import { DisposableObject } from "../common/disposable-object";
import type { DatabaseItem } from "../databases/local-databases";
import type { Method, Usage } from "./method";
import type { ModelEvaluationRun } from "./model-evaluation-run";
import type { ModeledMethod } from "./modeled-method";
import type { ModelingEvents } from "./modeling-events";
import { INITIAL_HIDE_MODELED_METHODS_VALUE } from "./shared/hide-modeled-methods";
import type { Mode } from "./shared/mode";
import { sortMethods } from "./shared/sorting";

interface InternalDbModelingState {
  databaseItem: DatabaseItem;
  methods: Method[];
  hideModeledMethods: boolean;
  mode: Mode;
  modeledMethods: Record<string, ModeledMethod[]>;
  modifiedMethodSignatures: Set<string>;
  selectedMethod: Method | undefined;
  selectedUsage: Usage | undefined;
  modelEvaluationRun: ModelEvaluationRun | undefined;
  isModelAlertsViewOpen: boolean;
}

export interface DbModelingState {
  readonly databaseItem: DatabaseItem;
  readonly methods: readonly Method[];
  readonly hideModeledMethods: boolean;
  readonly mode: Mode;
  readonly modeledMethods: Readonly<Record<string, readonly ModeledMethod[]>>;
  readonly modifiedMethodSignatures: ReadonlySet<string>;
  readonly selectedMethod: Method | undefined;
  readonly selectedUsage: Usage | undefined;
  readonly modelEvaluationRun: ModelEvaluationRun | undefined;
  readonly isModelAlertsViewOpen: boolean;
}

export interface SelectedMethodDetails {
  readonly databaseItem: DatabaseItem;
  readonly method: Method;
  readonly usage: Usage | undefined;
  readonly modeledMethods: readonly ModeledMethod[];
  readonly isModified: boolean;
}

export class ModelingStore extends DisposableObject {
  private readonly state: Map<string, InternalDbModelingState>;
  private activeDb: string | undefined;

  constructor(private readonly modelingEvents: ModelingEvents) {
    super();

    // State initialization
    this.state = new Map<string, InternalDbModelingState>();
  }

  public initializeStateForDb(databaseItem: DatabaseItem, mode: Mode) {
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
      modelEvaluationRun: undefined,
      isModelAlertsViewOpen: false,
    });

    this.modelingEvents.fireDbOpenedEvent(databaseItem);
  }

  public setActiveDb(databaseItem: DatabaseItem) {
    this.activeDb = databaseItem.databaseUri.toString();
    this.modelingEvents.fireActiveDbChangedEvent();
  }

  public removeDb(databaseItem: DatabaseItem) {
    const dbUri = databaseItem.databaseUri.toString();

    if (!this.state.has(dbUri)) {
      throw Error("Cannot remove a database that has not been initialized");
    }

    if (this.activeDb === dbUri) {
      this.activeDb = undefined;
      this.modelingEvents.fireActiveDbChangedEvent();
    }

    this.state.delete(dbUri);
    this.modelingEvents.fireDbClosedEvent(dbUri);
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

  public anyDbsBeingModeled(): boolean {
    return this.state.size > 0;
  }

  public isDbOpen(dbUri: string): boolean {
    return this.state.has(dbUri);
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
    this.changeMethods(dbItem, (state) => {
      state.methods = sortMethods(
        methods,
        state.modeledMethods,
        state.modifiedMethodSignatures,
      );
    });
  }

  public updateMethodSorting(dbItem: DatabaseItem) {
    this.changeMethods(dbItem, (state) => {
      state.methods = sortMethods(
        state.methods,
        state.modeledMethods,
        state.modifiedMethodSignatures,
      );
    });
  }

  public setHideModeledMethods(
    dbItem: DatabaseItem,
    hideModeledMethods: boolean,
  ) {
    const dbState = this.getState(dbItem);
    const dbUri = dbItem.databaseUri.toString();

    dbState.hideModeledMethods = hideModeledMethods;

    this.modelingEvents.fireHideModeledMethodsChangedEvent(
      hideModeledMethods,
      dbUri === this.activeDb,
    );
  }

  public setMode(dbItem: DatabaseItem, mode: Mode) {
    const dbState = this.getState(dbItem);
    const dbUri = dbItem.databaseUri.toString();

    dbState.mode = mode;

    this.modelingEvents.fireModeChangedEvent(mode, dbUri === this.activeDb);
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
    setModified: boolean,
  ) {
    this.changeModeledAndModifiedMethods(dbItem, (state) => {
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

      if (setModified) {
        const newModifiedMethods = new Set([
          ...state.modifiedMethodSignatures,
          ...new Set(Object.keys(methods)),
        ]);
        state.modifiedMethodSignatures = newModifiedMethods;
      }
    });
  }

  public setModeledMethods(
    dbItem: DatabaseItem,
    methods: Record<string, ModeledMethod[]>,
  ) {
    this.changeModeledAndModifiedMethods(dbItem, (state) => {
      state.modeledMethods = { ...methods };
    });
  }

  public updateModeledMethods(
    dbItem: DatabaseItem,
    signature: string,
    modeledMethods: ModeledMethod[],
    setModified: boolean,
  ) {
    this.changeModeledAndModifiedMethods(dbItem, (state) => {
      const newModeledMethods = { ...state.modeledMethods };
      newModeledMethods[signature] = modeledMethods;
      state.modeledMethods = newModeledMethods;

      if (setModified) {
        const newModifiedMethods = new Set([
          ...state.modifiedMethodSignatures,
          signature,
        ]);
        state.modifiedMethodSignatures = newModifiedMethods;
      }
    });
  }

  public removeModifiedMethods(
    dbItem: DatabaseItem,
    methodSignatures: string[],
  ) {
    this.changeModeledAndModifiedMethods(dbItem, (state) => {
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

    const modeledMethods = dbState.modeledMethods[method.signature] ?? [];
    const isModified = dbState.modifiedMethodSignatures.has(method.signature);
    this.modelingEvents.fireSelectedMethodChangedEvent(
      dbItem,
      method,
      usage,
      modeledMethods,
      isModified,
    );
  }

  public updateModelEvaluationRun(
    dbItem: DatabaseItem,
    evaluationRun: ModelEvaluationRun | undefined,
  ) {
    this.changeModelEvaluationRun(dbItem, (state) => {
      state.modelEvaluationRun = evaluationRun;
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

  public getModelEvaluationRun(
    dbItem: DatabaseItem,
  ): ModelEvaluationRun | undefined {
    return this.getState(dbItem).modelEvaluationRun;
  }

  private changeMethods(
    dbItem: DatabaseItem,
    updateState: (state: InternalDbModelingState) => void,
  ) {
    const state = this.getState(dbItem);

    updateState(state);

    this.modelingEvents.fireMethodsChangedEvent(
      state.methods,
      dbItem.databaseUri.toString(),
      dbItem,
      dbItem.databaseUri.toString() === this.activeDb,
    );
  }

  private changeModeledAndModifiedMethods(
    dbItem: DatabaseItem,
    updateState: (state: InternalDbModelingState) => void,
  ) {
    const state = this.getState(dbItem);

    updateState(state);

    this.modelingEvents.fireModeledAndModifiedMethodsChangedEvent(
      state.modeledMethods,
      state.modifiedMethodSignatures,
      dbItem.databaseUri.toString(),
      dbItem.databaseUri.toString() === this.activeDb,
    );
  }

  private changeModelEvaluationRun(
    dbItem: DatabaseItem,
    updateState: (state: InternalDbModelingState) => void,
  ) {
    const state = this.getState(dbItem);

    updateState(state);

    this.modelingEvents.fireModelEvaluationRunChangedEvent(
      dbItem.databaseUri.toString(),
      state.modelEvaluationRun,
    );
  }

  public isModelAlertsViewOpen(dbItem: DatabaseItem): boolean {
    return this.getState(dbItem).isModelAlertsViewOpen ?? false;
  }

  private changeIsModelAlertsViewOpen(
    dbItem: DatabaseItem,
    updateState: (state: InternalDbModelingState) => void,
  ) {
    const state = this.getState(dbItem);

    updateState(state);
  }

  public updateIsModelAlertsViewOpen(dbItem: DatabaseItem, isOpen: boolean) {
    this.changeIsModelAlertsViewOpen(dbItem, (state) => {
      state.isModelAlertsViewOpen = isOpen;
    });
  }
}
