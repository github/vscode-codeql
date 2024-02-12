// Avoid explicitly referencing Disposable type in vscode.
// This file cannot have dependencies on the vscode API.
export interface Disposable {
  dispose(): unknown;
}

export type DisposeHandler = (disposable: Disposable) => void;

/**
 * Base class to make it easier to implement a `Disposable` that owns other disposable object.
 */
export class DisposableObject implements Disposable {
  private disposables: Disposable[] = [];
  private tracked?: Set<Disposable> = undefined;

  constructor(...dispoables: Disposable[]) {
    for (const d of dispoables) {
      this.push(d);
    }
  }

  /**
   * Adds `obj` to a list of objects to dispose when `this` is disposed. Objects added by `push` are
   * disposed in reverse order of being added.
   * @param obj The object to take ownership of.
   */
  protected push<T extends Disposable>(obj: T): T {
    if (obj !== undefined) {
      this.disposables.push(obj);
    }
    return obj;
  }

  /**
   * Adds `obj` to a set of objects to dispose when `this` is disposed. Objects added by
   * `track` are disposed in an unspecified order.
   * @param obj The object to track.
   */
  protected track<T extends Disposable>(obj: T): T {
    if (obj !== undefined) {
      if (this.tracked === undefined) {
        this.tracked = new Set<Disposable>();
      }
      this.tracked.add(obj);
    }
    return obj;
  }

  /**
   * Removes `obj`, which must have been previously added by `track`, from the set of objects to
   * dispose when `this` is disposed. `obj` itself is disposed.
   * @param obj The object to stop tracking.
   */
  protected disposeAndStopTracking(obj: Disposable): void {
    if (obj && this.tracked) {
      this.tracked.delete(obj);
      obj.dispose();
    }
  }

  /**
   * Dispose this object and all contained objects
   *
   * @param disposeHandler An optional dispose handler that gets
   *      passed each element to dispose. The dispose handler
   *      can choose how (and if) to dispose the object. The
   *      primary usage is for tests that should not dispose
   *      all items of a disposable.
   */
  public dispose(disposeHandler?: DisposeHandler) {
    if (this.tracked !== undefined) {
      for (const trackedObject of this.tracked.values()) {
        if (disposeHandler) {
          disposeHandler(trackedObject);
        } else {
          trackedObject.dispose();
        }
      }
      this.tracked = undefined;
    }
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop()!;
      if (disposeHandler) {
        disposeHandler(disposable);
      } else {
        disposable.dispose();
      }
    }
  }
}
