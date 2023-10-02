interface ModelEditorViewInterface {
  databaseUri: string;
}

export class ModelEditorViewTracker<
  T extends ModelEditorViewInterface = ModelEditorViewInterface,
> {
  private readonly views = new Map<string, T[]>();

  constructor() {}

  public registerView(view: T): void {
    const databaseUri = view.databaseUri;

    if (!this.views.has(databaseUri)) {
      this.views.set(databaseUri, []);
    }

    this.views.get(databaseUri)?.push(view);
  }

  public unregisterView(view: T): void {
    const views = this.views.get(view.databaseUri);
    if (!views) {
      return;
    }

    const index = views.indexOf(view);
    if (index !== -1) {
      views.splice(index, 1);
    }
  }

  public getViews(databaseUri: string): T[] {
    return this.views.get(databaseUri) ?? [];
  }
}
