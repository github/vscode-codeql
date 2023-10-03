import { window } from "vscode";
import { App } from "../../common/app";
import { DisposableObject } from "../../common/disposable-object";
import { MethodModelingViewProvider } from "./method-modeling-view-provider";
import { Method } from "../method";
import { ModelingStore } from "../modeling-store";
import { ModelEditorViewTracker } from "../model-editor-view-tracker";

export class MethodModelingPanel extends DisposableObject {
  private readonly provider: MethodModelingViewProvider;

  constructor(
    private readonly app: App,
    modelingStore: ModelingStore,
    editorViewTracker: ModelEditorViewTracker,
  ) {
    super();

    this.provider = new MethodModelingViewProvider(
      app,
      modelingStore,
      editorViewTracker,
    );
    this.push(
      window.registerWebviewViewProvider(
        MethodModelingViewProvider.viewType,
        this.provider,
        { webviewOptions: { retainContextWhenHidden: true } },
      ),
    );
  }

  public async setMethod(method: Method): Promise<void> {
    await this.provider.setMethod(method);
  }

  public async show(): Promise<void> {
    await this.app.commands.execute("codeQLMethodModeling.focus");
  }
}
