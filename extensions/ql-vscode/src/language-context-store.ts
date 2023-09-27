import { App } from "./common/app";
import { DisposableObject } from "./common/disposable-object";
import { AppEvent, AppEventEmitter } from "./common/events";
import { QueryLanguage } from "./common/query-language";

type LanguageFilter = QueryLanguage | "All";

export class LanguageContextStore extends DisposableObject {
  public readonly onLanguageContextChanged: AppEvent<void>;
  private readonly onLanguageContextChangedEmitter: AppEventEmitter<void>;

  private state: LanguageFilter;

  constructor(app: App) {
    super();
    // State initialization
    this.state = "All";

    // Set up event emitters
    this.onLanguageContextChangedEmitter = this.push(
      app.createEventEmitter<void>(),
    );
    this.onLanguageContextChanged = this.onLanguageContextChangedEmitter.event;
  }

  public clearLanguageContext() {
    this.state = "All";
    this.onLanguageContextChangedEmitter.fire();
  }

  public setLanguageContext(language: QueryLanguage) {
    this.state = language;
    this.onLanguageContextChangedEmitter.fire();
  }

  // TODO: comment on why string is used here
  public shouldInclude(language: string): boolean {
    return this.state === "All" || this.state === language;
  }
}
