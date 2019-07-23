import { Disposable } from "vscode";

export abstract class DisposableObject implements Disposable {
  private disposables: Disposable[] = [];

  constructor() {
  }

  protected push<T extends Disposable>(disposable: T): T {
    this.disposables.push(disposable);
    return disposable;
  }

  dispose() {
    while (this.disposables.length > 0) {
      this.disposables.pop()!.dispose();
    }
  }
}
