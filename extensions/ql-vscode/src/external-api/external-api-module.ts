import { ExtensionContext } from "vscode";
import { ExternalApiView } from "./external-api-view";
import { ExternalApiCommands } from "../common/commands";

export class ExternalApiModule {
  public constructor(private readonly ctx: ExtensionContext) {}

  public getCommands(): ExternalApiCommands {
    return {
      "codeQL.openExternalApi": async () => {
        const view = new ExternalApiView(this.ctx);
        await view.openView();
      },
    };
  }
}
