import { App } from "../common/app";
import { DisposableObject } from "../common/disposable-object";
import { AppEvent, AppEventEmitter } from "../common/events";
import { DatabaseItem } from "../databases/local-databases";
import { Method, Usage } from "./method";
import { ModeledMethod } from "./modeled-method";
import { Mode } from "./shared/mode";

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
  readonly isInProgress: boolean;
}

interface InProgressMethodsChangedEvent {
  readonly dbUri: string;
  readonly methods: ReadonlySet<string>;
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
  public readonly onMethodsChanged: AppEvent<MethodsChangedEvent>;
  public readonly onHideModeledMethodsChanged: AppEvent<HideModeledMethodsChangedEvent>;
  public readonly onModeChanged: AppEvent<ModeChangedEvent>;
  public readonly onModeledMethodsChanged: AppEvent<ModeledMethodsChangedEvent>;
  public readonly onModifiedMethodsChanged: AppEvent<ModifiedMethodsChangedEvent>;
  public readonly onSelectedMethodChanged: AppEvent<SelectedMethodChangedEvent>;
  public readonly onInProgressMethodsChanged: AppEvent<InProgressMethodsChangedEvent>;
  public readonly onRevealInModelEditor: AppEvent<RevealInModelEditorEvent>;
  public readonly onFocusModelEditor: AppEvent<FocusModelEditorEvent>;

  private readonly onActiveDbChangedEventEmitter: AppEventEmitter<void>;
  private readonly onDbOpenedEventEmitter: AppEventEmitter<DatabaseItem>;
  private readonly onDbClosedEventEmitter: AppEventEmitter<string>;
  private readonly onMethodsChangedEventEmitter: AppEventEmitter<MethodsChangedEvent>;
  private readonly onHideModeledMethodsChangedEventEmitter: AppEventEmitter<HideModeledMethodsChangedEvent>;
  private readonly onModeChangedEventEmitter: AppEventEmitter<ModeChangedEvent>;
  private readonly onModeledMethodsChangedEventEmitter: AppEventEmitter<ModeledMethodsChangedEvent>;
  private readonly onModifiedMethodsChangedEventEmitter: AppEventEmitter<ModifiedMethodsChangedEvent>;
  private readonly onSelectedMethodChangedEventEmitter: AppEventEmitter<SelectedMethodChangedEvent>;
  private readonly onInProgressMethodsChangedEventEmitter: AppEventEmitter<InProgressMethodsChangedEvent>;
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

  public fireModeledMethodsChangedEvent(
    modeledMethods: Record<string, ModeledMethod[]>,
    dbUri: string,
    isActiveDb: boolean,
  ) {
    this.onModeledMethodsChangedEventEmitter.fire({
      modeledMethods,
      dbUri,
      isActiveDb,
    });
  }

  public fireModifiedMethodsChangedEvent(
    modifiedMethods: ReadonlySet<string>,
    dbUri: string,
    isActiveDb: boolean,
  ) {
    this.onModifiedMethodsChangedEventEmitter.fire({
      modifiedMethods,
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
    isInProgress: boolean,
  ) {
    this.onSelectedMethodChangedEventEmitter.fire({
      databaseItem,
      method,
      usage,
      modeledMethods,
      isModified,
      isInProgress,
    });
  }

  public fireInProgressMethodsChangedEvent(
    dbUri: string,
    methods: ReadonlySet<string>,
  ) {
    this.onInProgressMethodsChangedEventEmitter.fire({
      dbUri,
      methods,
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
