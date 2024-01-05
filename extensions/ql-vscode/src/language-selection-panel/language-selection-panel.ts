import { DisposableObject } from "../common/disposable-object";
import { window } from "vscode";
import type { LanguageSelectionTreeViewItem } from "./language-selection-data-provider";
import { LanguageSelectionTreeDataProvider } from "./language-selection-data-provider";
import type { LanguageContextStore } from "../language-context-store";
import type { LanguageSelectionCommands } from "../common/commands";

// This panel allows the selection of a single language, that will
// then filter all other relevant views (e.g. db panel, query history).
export class LanguageSelectionPanel extends DisposableObject {
  constructor(private readonly languageContext: LanguageContextStore) {
    super();

    const dataProvider = new LanguageSelectionTreeDataProvider(languageContext);
    this.push(dataProvider);

    const treeView = window.createTreeView("codeQLLanguageSelection", {
      treeDataProvider: dataProvider,
    });
    this.push(treeView);
  }

  public getCommands(): LanguageSelectionCommands {
    return {
      "codeQLLanguageSelection.setSelectedItem":
        this.handleSetSelectedLanguage.bind(this),
    };
  }

  private async handleSetSelectedLanguage(
    item: LanguageSelectionTreeViewItem,
  ): Promise<void> {
    if (item.language) {
      await this.languageContext.setLanguageContext(item.language);
    } else {
      await this.languageContext.clearLanguageContext();
    }
  }
}
