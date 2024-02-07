import type { CancellationToken, Disposable } from "vscode";
import { DisposableObject } from "../disposable-object";

/**
 * A cancellation token that cancels when any of its constituent
 * cancellation tokens are cancelled.
 */
export class MultiCancellationToken implements CancellationToken {
  private readonly tokens: CancellationToken[];

  constructor(...tokens: CancellationToken[]) {
    this.tokens = tokens;
  }

  get isCancellationRequested(): boolean {
    return this.tokens.some((t) => t.isCancellationRequested);
  }

  onCancellationRequested<T>(listener: (e: T) => void): Disposable {
    return new DisposableObject(
      ...this.tokens.map((t) => t.onCancellationRequested(listener)),
    );
  }
}
