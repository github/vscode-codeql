import { window } from "vscode";
import { App } from "../../common/app";
import { DisposableObject } from "../../common/disposable-object";
import { MethodModelingViewProvider } from "./method-modeling-view-provider";
import { Method } from "../method";
import { ModelingStore } from "../modeling-store";
import { ModelEditorViewTracker } from "../model-editor-view-tracker";
import { ModelConfigListener } from "../../config";

export class MethodModelingPanel extends DisposableObject {
  private readonly provider: MethodModelingViewProvider;

  constructor(
    app: App,
    modelingStore: ModelingStore,
    editorViewTracker: ModelEditorViewTracker,
  ) {
    super();

    // This is here instead of in MethodModelingViewProvider because we need to
    // dispose this when the extension gets disposed, not when the webview gets
    // disposed.
    const modelConfig = this.push(new ModelConfigListener());

    this.provider = new MethodModelingViewProvider(
      app,
      modelingStore,
      editorViewTracker,
      modelConfig,
    );
    this.push(
      window.registerWebviewViewProvider(
        MethodModelingViewProvider.viewType,
        this.provider,
      ),
    );
  }

  public async setMethod(method: Method): Promise<void> {
    await this.provider.setMethod(method);
  }
}
