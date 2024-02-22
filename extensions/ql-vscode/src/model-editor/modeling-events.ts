import type { App } from "../common/app";
import { DisposableObject } from "../common/disposable-object";
import type { AppEvent, AppEventEmitter } from "../common/events";
import type { DatabaseItem } from "../databases/local-databases";
import type { Method, Usage } from "./method";
import type { ModeledMethod } from "./modeled-method";
import type { Mode } from "./shared/mode";

interface ModelingStateChangedEvent {
  readonly dbUri: string;
  readonly databaseItem: DatabaseItem;
  readonly isActiveDb: boolean;
  readonly methods?: readonly Method[];
  readonly modeledMethods?: Readonly<Record<string, ModeledMethod[]>>;
  readonly modifiedMethodSignatures?: ReadonlySet<string>;
  readonly inProgressMethodSignatures?: ReadonlySet<string>;
  readonly processedByAutoModelMethodSignatures?: ReadonlySet<string>;
}

interface HideModeledMethodsChangedEvent {
  readonly hideModeledMethods: boolean;
  readonly isActiveDb: boolean;
}

interface ModeChangedEvent {
  readonly mode: Mode;
  readonly isActiveDb: boolean;
}

interface SelectedMethodChangedEvent {
  readonly databaseItem: DatabaseItem;
  readonly method: Method;
  readonly usage: Usage;
  readonly modeledMethods: readonly ModeledMethod[];
  readonly isModified: boolean;
  readonly isInProgress: boolean;
  readonly processedByAutoModel: boolean;
}

interface RevealInModelEditorEvent {
  dbUri: string;
  method: Method;
}

interface FocusModelEditorEvent {
  dbUri: string;
}

export class ModelingEvents extends DisposableObject {
  public readonly onActiveDbChanged: AppEvent<void>;
  public readonly onDbOpened: AppEvent<DatabaseItem>;
  public readonly onDbClosed: AppEvent<string>;
  public readonly onModelingStateChanged: AppEvent<ModelingStateChangedEvent>;
  public readonly onHideModeledMethodsChanged: AppEvent<HideModeledMethodsChangedEvent>;
  public readonly onModeChanged: AppEvent<ModeChangedEvent>;
  public readonly onSelectedMethodChanged: AppEvent<SelectedMethodChangedEvent>;
  public readonly onRevealInModelEditor: AppEvent<RevealInModelEditorEvent>;
  public readonly onFocusModelEditor: AppEvent<FocusModelEditorEvent>;

  private readonly onActiveDbChangedEventEmitter: AppEventEmitter<void>;
  private readonly onDbOpenedEventEmitter: AppEventEmitter<DatabaseItem>;
  private readonly onDbClosedEventEmitter: AppEventEmitter<string>;
  private readonly onModelingStateChangedEventEmitter: AppEventEmitter<ModelingStateChangedEvent>;
  private readonly onHideModeledMethodsChangedEventEmitter: AppEventEmitter<HideModeledMethodsChangedEvent>;
  private readonly onModeChangedEventEmitter: AppEventEmitter<ModeChangedEvent>;
  private readonly onSelectedMethodChangedEventEmitter: AppEventEmitter<SelectedMethodChangedEvent>;
  private readonly onRevealInModelEditorEventEmitter: AppEventEmitter<RevealInModelEditorEvent>;
  private readonly onFocusModelEditorEventEmitter: AppEventEmitter<FocusModelEditorEvent>;

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

    this.onModelingStateChangedEventEmitter = this.push(
      app.createEventEmitter<ModelingStateChangedEvent>(),
    );
    this.onModelingStateChanged = this.onModelingStateChangedEventEmitter.event;

    this.onHideModeledMethodsChangedEventEmitter = this.push(
      app.createEventEmitter<HideModeledMethodsChangedEvent>(),
    );
    this.onHideModeledMethodsChanged =
      this.onHideModeledMethodsChangedEventEmitter.event;

    this.onModeChangedEventEmitter = this.push(
      app.createEventEmitter<ModeChangedEvent>(),
    );
    this.onModeChanged = this.onModeChangedEventEmitter.event;

    this.onSelectedMethodChangedEventEmitter = this.push(
      app.createEventEmitter<SelectedMethodChangedEvent>(),
    );
    this.onSelectedMethodChanged =
      this.onSelectedMethodChangedEventEmitter.event;

    this.onRevealInModelEditorEventEmitter = this.push(
      app.createEventEmitter<RevealInModelEditorEvent>(),
    );
    this.onRevealInModelEditor = this.onRevealInModelEditorEventEmitter.event;

    this.onFocusModelEditorEventEmitter = this.push(
      app.createEventEmitter<FocusModelEditorEvent>(),
    );
    this.onFocusModelEditor = this.onFocusModelEditorEventEmitter.event;
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

  public fireModelingStateChangedEvent(event: ModelingStateChangedEvent) {
    this.onModelingStateChangedEventEmitter.fire(event);
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

  public fireSelectedMethodChangedEvent(
    databaseItem: DatabaseItem,
    method: Method,
    usage: Usage,
    modeledMethods: ModeledMethod[],
    isModified: boolean,
    isInProgress: boolean,
    processedByAutoModel: boolean,
  ) {
    this.onSelectedMethodChangedEventEmitter.fire({
      databaseItem,
      method,
      usage,
      modeledMethods,
      isModified,
      isInProgress,
      processedByAutoModel,
    });
  }

  public fireRevealInModelEditorEvent(dbUri: string, method: Method) {
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
}
