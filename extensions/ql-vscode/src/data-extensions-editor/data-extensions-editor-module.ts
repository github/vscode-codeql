import { ExtensionContext } from "vscode";
import { DataExtensionsEditorView } from "./data-extensions-editor-view";
import { DataExtensionsEditorCommands } from "../common/commands";

export class DataExtensionsEditorModule {
  public constructor(private readonly ctx: ExtensionContext) {}

  public getCommands(): DataExtensionsEditorCommands {
    return {
      "codeQL.openDataExtensionsEditor": async () => {
        const view = new DataExtensionsEditorView(this.ctx);
        await view.openView();
      },
    };
  }
}
