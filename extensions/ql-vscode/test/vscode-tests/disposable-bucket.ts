import type { Disposable } from "vscode";
import { DisposableObject } from "../../src/common/disposable-object";

/**
 * A simple disposable object that does nothing other than contain a list of disposable objects.
 * This is useful for implementing a `Disposable` that owns other disposable objects.
 */
export class DisposableBucket extends DisposableObject {
  /**
   * Add a disposable object to this bucket.
   * @param obj The object to add.
   */
  public push<T extends Disposable>(obj: T): T {
    return super.push(obj);
  }
}
