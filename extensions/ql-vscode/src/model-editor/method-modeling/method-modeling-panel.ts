import { window } from "vscode";
import { App } from "../../common/app";
import { DisposableObject } from "../../common/disposable-object";
import { MethodModelingViewProvider } from "./method-modeling-view-provider";
import { Method } from "../method";

export class MethodModelingPanel extends DisposableObject {
  private readonly provider: MethodModelingViewProvider;

  constructor(app: App) {
    super();

    this.provider = new MethodModelingViewProvider(app);
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
