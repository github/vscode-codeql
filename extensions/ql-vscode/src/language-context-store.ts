import { App } from "./common/app";
import { DisposableObject } from "./common/disposable-object";
import { AppEvent, AppEventEmitter } from "./common/events";
import { QueryLanguage } from "./common/query-language";

type LanguageFilter = QueryLanguage | "All";

export class LanguageContextStore extends DisposableObject {
  public readonly onLanguageContextChanged: AppEvent<void>;
  private readonly onLanguageContextChangedEmitter: AppEventEmitter<void>;

  private languageFilter: LanguageFilter;

  constructor(private readonly app: App) {
    super();
    // State initialization
    this.languageFilter = "All";

    // Set up event emitters
    this.onLanguageContextChangedEmitter = this.push(
      app.createEventEmitter<void>(),
    );
    this.onLanguageContextChanged = this.onLanguageContextChangedEmitter.event;
  }

  public async clearLanguageContext() {
    this.languageFilter = "All";
    this.onLanguageContextChangedEmitter.fire();
    await this.app.commands.execute(
      "setContext",
      "codeQLDatabases.languageFilter",
      "",
    );
  }

  public async setLanguageContext(language: QueryLanguage) {
    this.languageFilter = language;
    this.onLanguageContextChangedEmitter.fire();
    await this.app.commands.execute(
      "setContext",
      "codeQLDatabases.languageFilter",
      language,
    );
  }

  // shouldInclude should return true if the given language should be included.
  // That means that either the given language is selected or the "All" option is selected.
  public shouldInclude(language: QueryLanguage | undefined): boolean {
    return this.languageFilter === "All" || this.languageFilter === language;
  }

  // isSelectedLanguage returns true if the given language is selected. If no language
  // is given then it returns true if the "All" option is selected.
  public isSelectedLanguage(language: QueryLanguage | undefined): boolean {
    return (
      (this.languageFilter === "All" && language === undefined) ||
      this.languageFilter === language
    );
  }
}
