/**
 * This interface mirrors the vscode.Disaposable class, so that
 * the command manager does not depend on vscode directly.
 */
export interface Disposable {
  dispose(): void;
}
