import { Disposable } from "vscode";

export abstract class DisposableObject implements Disposable {
  private disposables: Disposable[] = [];
  private tracked?: Set<Disposable> = undefined;

  constructor() {
  }

  protected push<T extends Disposable>(obj: T): T {
    if (obj !== undefined) {
      this.disposables.push(obj);
    }
    return obj;
  }

  protected track<T extends Disposable>(obj: T): T {
    if (obj !== undefined) {
      if (this.tracked === undefined) {
        this.tracked = new Set<Disposable>();
      }
      this.tracked.add(obj);
    }
    return obj;
  }

  protected disposeAndStopTracking(obj: Disposable): void {
    if (obj !== undefined) {
      this.tracked!.delete(obj);
      obj.dispose();
    }
  }

  public dispose() {
    if (this.tracked !== undefined) {
      for (const trackedObject of this.tracked) {
        trackedObject.dispose();
      }
      this.tracked = undefined;
    }
    while (this.disposables.length > 0) {
      this.disposables.pop()!.dispose();
    }
  }
}
