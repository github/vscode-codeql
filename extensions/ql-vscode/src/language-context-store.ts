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

  // This method takes a string to allow it to be used in cases
  // where the language is not always a known one.
  // The semantics of such an unknown langauge is that it is
  // only included if the current language context is "All".
  public shouldInclude(language: string): boolean {
    return this.languageFilter === "All" || this.languageFilter === language;
  }
}
