import type { App } from "../common/app";
import { DisposableObject } from "../common/disposable-object";
import type { AppEvent, AppEventEmitter } from "../common/events";
import type { DatabaseItem } from "../databases/local-databases";
import type { Method, MethodSignature, Usage } from "./method";
import type { ModelEvaluationRun } from "./model-evaluation-run";
import type { ModeledMethod } from "./modeled-method";
import type { Mode } from "./shared/mode";

interface MethodsChangedEvent {
  readonly methods: readonly Method[];
  readonly dbUri: string;
  readonly databaseItem: DatabaseItem;
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

interface ModeledAndModifiedMethodsChangedEvent {
  readonly modeledMethods: Readonly<Record<string, ModeledMethod[]>>;
  readonly modifiedMethodSignatures: ReadonlySet<string>;
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

interface ModelEvaluationRunChangedEvent {
  readonly dbUri: string;
  readonly evaluationRun: ModelEvaluationRun | undefined;
}

interface RevealInModelEditorEvent {
  dbUri: string;
  method: MethodSignature;
}

interface FocusModelEditorEvent {
  dbUri: string;
}

interface FocusModelAlertsViewEvent {
  dbUri: string;
}

interface RevealInModelAlertsViewEvent {
  dbUri: string;
  modeledMethod: ModeledMethod;
}

export class ModelingEvents extends DisposableObject {
  public readonly onActiveDbChanged: AppEvent<void>;
  public readonly onDbOpened: AppEvent<DatabaseItem>;
  public readonly onDbClosed: AppEvent<string>;
  public readonly onMethodsChanged: AppEvent<MethodsChangedEvent>;
  public readonly onHideModeledMethodsChanged: AppEvent<HideModeledMethodsChangedEvent>;
  public readonly onModeChanged: AppEvent<ModeChangedEvent>;
  public readonly onModeledAndModifiedMethodsChanged: AppEvent<ModeledAndModifiedMethodsChangedEvent>;
  public readonly onSelectedMethodChanged: AppEvent<SelectedMethodChangedEvent>;
  public readonly onModelEvaluationRunChanged: AppEvent<ModelEvaluationRunChangedEvent>;
  public readonly onRevealInModelEditor: AppEvent<RevealInModelEditorEvent>;
  public readonly onFocusModelEditor: AppEvent<FocusModelEditorEvent>;
  public readonly onFocusModelAlertsView: AppEvent<FocusModelAlertsViewEvent>;
  public readonly onRevealInModelAlertsView: AppEvent<RevealInModelAlertsViewEvent>;

  private readonly onActiveDbChangedEventEmitter: AppEventEmitter<void>;
  private readonly onDbOpenedEventEmitter: AppEventEmitter<DatabaseItem>;
  private readonly onDbClosedEventEmitter: AppEventEmitter<string>;
  private readonly onMethodsChangedEventEmitter: AppEventEmitter<MethodsChangedEvent>;
  private readonly onHideModeledMethodsChangedEventEmitter: AppEventEmitter<HideModeledMethodsChangedEvent>;
  private readonly onModeChangedEventEmitter: AppEventEmitter<ModeChangedEvent>;
  private readonly onModeledAndModifiedMethodsChangedEventEmitter: AppEventEmitter<ModeledAndModifiedMethodsChangedEvent>;
  private readonly onSelectedMethodChangedEventEmitter: AppEventEmitter<SelectedMethodChangedEvent>;
  private readonly onModelEvaluationRunChangedEventEmitter: AppEventEmitter<ModelEvaluationRunChangedEvent>;
  private readonly onRevealInModelEditorEventEmitter: AppEventEmitter<RevealInModelEditorEvent>;
  private readonly onFocusModelEditorEventEmitter: AppEventEmitter<FocusModelEditorEvent>;
  private readonly onFocusModelAlertsViewEventEmitter: AppEventEmitter<FocusModelAlertsViewEvent>;
  private readonly onRevealInModelAlertsViewEventEmitter: AppEventEmitter<RevealInModelAlertsViewEvent>;

  constructor(app: App) {
    super();

    this.onActiveDbChangedEventEmitter = this.push(
      app.createEventEmitter<void>(),
    );
    this.onActiveDbChanged = this.onActiveDbChangedEventEmitter.event;

    this.onDbOpenedEventEmitter = this.push(
      app.createEventEmitter<DatabaseItem>(),
    );
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

    this.onModeledAndModifiedMethodsChangedEventEmitter = this.push(
      app.createEventEmitter<ModeledAndModifiedMethodsChangedEvent>(),
    );
    this.onModeledAndModifiedMethodsChanged =
      this.onModeledAndModifiedMethodsChangedEventEmitter.event;

    this.onSelectedMethodChangedEventEmitter = this.push(
      app.createEventEmitter<SelectedMethodChangedEvent>(),
    );
    this.onSelectedMethodChanged =
      this.onSelectedMethodChangedEventEmitter.event;

    this.onModelEvaluationRunChangedEventEmitter = this.push(
      app.createEventEmitter<ModelEvaluationRunChangedEvent>(),
    );
    this.onModelEvaluationRunChanged =
      this.onModelEvaluationRunChangedEventEmitter.event;

    this.onRevealInModelEditorEventEmitter = this.push(
      app.createEventEmitter<RevealInModelEditorEvent>(),
    );
    this.onRevealInModelEditor = this.onRevealInModelEditorEventEmitter.event;

    this.onFocusModelEditorEventEmitter = this.push(
      app.createEventEmitter<FocusModelEditorEvent>(),
    );
    this.onFocusModelEditor = this.onFocusModelEditorEventEmitter.event;

    this.onFocusModelAlertsViewEventEmitter = this.push(
      app.createEventEmitter<FocusModelAlertsViewEvent>(),
    );
    this.onFocusModelAlertsView = this.onFocusModelAlertsViewEventEmitter.event;

    this.onRevealInModelAlertsViewEventEmitter = this.push(
      app.createEventEmitter<RevealInModelAlertsViewEvent>(),
    );
    this.onRevealInModelAlertsView =
      this.onRevealInModelAlertsViewEventEmitter.event;
  }

  public fireActiveDbChangedEvent() {
    this.onActiveDbChangedEventEmitter.fire();
  }

  public fireDbOpenedEvent(databaseItem: DatabaseItem) {
    this.onDbOpenedEventEmitter.fire(databaseItem);
  }

  public fireDbClosedEvent(dbUri: string) {
    this.onDbClosedEventEmitter.fire(dbUri);
  }

  public fireMethodsChangedEvent(
    methods: Method[],
    dbUri: string,
    databaseItem: DatabaseItem,
    isActiveDb: boolean,
  ) {
    this.onMethodsChangedEventEmitter.fire({
      methods,
      databaseItem,
      dbUri,
      isActiveDb,
    });
  }

  public fireHideModeledMethodsChangedEvent(
    hideModeledMethods: boolean,
    isActiveDb: boolean,
  ) {
    this.onHideModeledMethodsChangedEventEmitter.fire({
      hideModeledMethods,
      isActiveDb,
    });
  }

  public fireModeChangedEvent(mode: Mode, isActiveDb: boolean) {
    this.onModeChangedEventEmitter.fire({
      mode,
      isActiveDb,
    });
  }

  public fireModeledAndModifiedMethodsChangedEvent(
    modeledMethods: Record<string, ModeledMethod[]>,
    modifiedMethodSignatures: ReadonlySet<string>,
    dbUri: string,
    isActiveDb: boolean,
  ) {
    this.onModeledAndModifiedMethodsChangedEventEmitter.fire({
      modeledMethods,
      modifiedMethodSignatures,
      dbUri,
      isActiveDb,
    });
  }

  public fireSelectedMethodChangedEvent(
    databaseItem: DatabaseItem,
    method: Method,
    usage: Usage,
    modeledMethods: ModeledMethod[],
    isModified: boolean,
  ) {
    this.onSelectedMethodChangedEventEmitter.fire({
      databaseItem,
      method,
      usage,
      modeledMethods,
      isModified,
    });
  }

  public fireModelEvaluationRunChangedEvent(
    dbUri: string,
    evaluationRun: ModelEvaluationRun | undefined,
  ) {
    this.onModelEvaluationRunChangedEventEmitter.fire({
      dbUri,
      evaluationRun,
    });
  }

  public fireRevealInModelEditorEvent(dbUri: string, method: MethodSignature) {
    this.onRevealInModelEditorEventEmitter.fire({
      dbUri,
      method,
    });
  }

  public fireFocusModelEditorEvent(dbUri: string) {
    this.onFocusModelEditorEventEmitter.fire({
      dbUri,
    });
  }

  public fireFocusModelAlertsViewEvent(dbUri: string) {
    this.onFocusModelAlertsViewEventEmitter.fire({ dbUri });
  }

  public fireRevealInModelAlertsViewEvent(
    dbUri: string,
    modeledMethod: ModeledMethod,
  ) {
    this.onRevealInModelAlertsViewEventEmitter.fire({ dbUri, modeledMethod });
  }
}
