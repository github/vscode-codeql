import { window } from "vscode";
import { App } from "../common/app";
import { DisposableObject } from "../common/disposable-object";
import { LanguageFilterViewProvider } from "./language-filter-view-provider";
import { LanguageContextStore } from "../language-context-store";

export class LanguageFilterPanel extends DisposableObject {
  private readonly provider: LanguageFilterViewProvider;

  constructor(app: App, languageContext: LanguageContextStore) {
    super();

    this.provider = new LanguageFilterViewProvider(app, languageContext);
    this.push(
      window.registerWebviewViewProvider(
        LanguageFilterViewProvider.viewType,
        this.provider,
      ),
    );
  }
}
