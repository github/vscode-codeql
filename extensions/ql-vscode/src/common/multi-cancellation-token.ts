import { CancellationToken, Disposable } from "vscode";

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

  onCancellationRequested<T>(listener: (e: T) => any): Disposable {
    this.tokens.forEach((t) => t.onCancellationRequested(listener));
    return {
      dispose: () => {
        this.tokens.forEach((t) =>
          t.onCancellationRequested(listener).dispose(),
        );
      },
    };
  }
}
