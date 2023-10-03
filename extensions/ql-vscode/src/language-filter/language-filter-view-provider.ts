import {
  FromLanguageFilterMessage,
  ToLanguageFilterMessage,
} from "../common/interface-types";
import { telemetryListener } from "../common/vscode/telemetry";
import { showAndLogExceptionWithTelemetry } from "../common/logging/notifications";
import { extLogger } from "../common/logging/vscode/loggers";
import { redactableError } from "../common/errors";
import { App } from "../common/app";
import { LanguageContextStore } from "../language-context-store";
import { AbstractWebviewViewProvider } from "../common/vscode/abstract-webview-view-provider";

export class LanguageFilterViewProvider extends AbstractWebviewViewProvider<
  ToLanguageFilterMessage,
  FromLanguageFilterMessage
> {
  public static readonly viewType = "codeQLLanguageFilter";

  constructor(
    app: App,
    private languageContext: LanguageContextStore,
  ) {
    super(app, "language-filter");
  }

  protected override async onMessage(
    msg: FromLanguageFilterMessage,
  ): Promise<void> {
    switch (msg.t) {
      case "telemetry":
        telemetryListener?.sendUIInteraction(msg.action);
        break;
      case "unhandledError":
        void showAndLogExceptionWithTelemetry(
          extLogger,
          telemetryListener,
          redactableError(
            msg.error,
          )`Unhandled error in language filter view: ${msg.error.message}`,
        );
        break;
      case "clearLanguageFilter":
        await this.languageContext.clearLanguageContext();
        break;
      case "setLanguageFilter":
        await this.languageContext.setLanguageContext(msg.language);
        break;
    }
  }
}
