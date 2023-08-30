import { ExtensionContext, window } from "vscode";
import { DisposableObject } from "../../common/disposable-object";
import { MethodModelingViewProvider } from "./method-modeling-view-provider";

export class MethodModelingPanel extends DisposableObject {
  constructor(context: ExtensionContext) {
    super();

    const provider = new MethodModelingViewProvider(context);
    this.push(
      window.registerWebviewViewProvider(
        MethodModelingViewProvider.viewType,
        provider,
      ),
    );
  }
}
