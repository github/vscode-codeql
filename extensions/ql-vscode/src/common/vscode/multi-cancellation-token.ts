import { CancellationToken, Event, EventEmitter } from "vscode";

/**
 * A cancellation token that cancels when any of its constituent
 * cancellation tokens are cancelled.
 */
export class MultiCancellationToken implements CancellationToken {
  private readonly tokens: CancellationToken[];
  private readonly onCancellationRequestedEvent = new EventEmitter<void>();

  constructor(...tokens: CancellationToken[]) {
    this.tokens = tokens;
    tokens.forEach((t) =>
      t.onCancellationRequested(() => this.onCancellationRequestedEvent.fire()),
    );
  }

  get isCancellationRequested(): boolean {
    return this.tokens.some((t) => t.isCancellationRequested);
  }

  get onCancellationRequested(): Event<any> {
    return this.onCancellationRequestedEvent.event;
  }
}
