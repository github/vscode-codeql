import { Disposable } from "vscode";
import { DisposableObject } from "../../src/pure/disposable-object";

export function testDisposeHandler(disposable: any & Disposable) {
  if (
    disposable.onDidExpandElement &&
    disposable.onDidCollapseElement &&
    disposable.reveal
  ) {
    // This looks like a treeViewer. Don't dispose
    return;
  }
  if (disposable instanceof DisposableObject) {
    disposable.dispose(testDisposeHandler);
  } else {
    disposable.dispose();
  }
}
