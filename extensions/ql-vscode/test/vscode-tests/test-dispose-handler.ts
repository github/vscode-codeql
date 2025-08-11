import type { Disposable, TreeView } from "vscode";
import { DisposableObject } from "../../src/common/disposable-object";

function isTreeView(obj: unknown): obj is TreeView<unknown> {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "onDidExpandElement" in obj &&
    "onDidCollapseElement" in obj &&
    "reveal" in obj
  );
}

export function testDisposeHandler(disposable: Disposable) {
  if (isTreeView(disposable)) {
    // This looks like a TreeView. Don't dispose
    return;
  }
  if (disposable instanceof DisposableObject) {
    disposable.dispose(testDisposeHandler);
  } else {
    disposable.dispose();
  }
}
