import { ExtensionContext, window } from "vscode";
import { DisposableObject } from "../../common/disposable-object";
import { MethodModelingViewProvider } from "./method-modeling-view-provider";
import { ExternalApiUsage } from "../external-api-usage";

export class MethodModelingPanel extends DisposableObject {
  private readonly provider: MethodModelingViewProvider;

  constructor(context: ExtensionContext) {
    super();

    this.provider = new MethodModelingViewProvider(context);
    this.push(
      window.registerWebviewViewProvider(
        MethodModelingViewProvider.viewType,
        this.provider,
      ),
    );
  }

  public async setMethod(method: ExternalApiUsage): Promise<void> {
    await this.provider.setMethod(method);
  }
}
