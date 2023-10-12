import { Method } from "./method";

interface ModelEditorViewInterface {
  databaseUri: string;

  revealMethod(method: Method): Promise<void>;
}

export class ModelEditorViewTracker<
  T extends ModelEditorViewInterface = ModelEditorViewInterface,
> {
  private readonly views = new Map<string, T>();

  constructor() {}

  public registerView(view: T): void {
    const databaseUri = view.databaseUri;

    if (this.views.has(databaseUri)) {
      throw new Error(`View for database ${databaseUri} already registered`);
    }

    this.views.set(databaseUri, view);
  }

  public unregisterView(view: T): void {
    this.views.delete(view.databaseUri);
  }

  public getView(databaseUri: string): T | undefined {
    return this.views.get(databaseUri);
  }
}
