import { window } from "vscode";
import { App } from "../../common/app";
import { DisposableObject } from "../../common/disposable-object";
import { MethodModelingViewProvider } from "./method-modeling-view-provider";
import { Method } from "../method";
import { ModelingStore } from "../modeling-store";

export class MethodModelingPanel extends DisposableObject {
  private readonly provider: MethodModelingViewProvider;

  constructor(app: App, modelingStore: ModelingStore) {
    super();

    this.provider = new MethodModelingViewProvider(app, modelingStore);
    this.push(this.provider);
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
