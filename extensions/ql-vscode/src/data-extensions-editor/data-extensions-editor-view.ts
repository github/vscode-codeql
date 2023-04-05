import { CancellationTokenSource, ExtensionContext, ViewColumn } from "vscode";
import { AbstractWebview, WebviewPanelConfig } from "../abstract-webview";
import {
  FromDataExtensionsEditorMessage,
  ToDataExtensionsEditorMessage,
} from "../pure/interface-types";
import { ProgressUpdate } from "../progress";
import { QueryRunner } from "../queryRunner";
import { showAndLogExceptionWithTelemetry } from "../helpers";
import { DatabaseItem } from "../local-databases";
import { CodeQLCliServer } from "../cli";
import { decodeBqrsToExternalApiUsages } from "./bqrs";
import { redactableError } from "../pure/errors";
import { asError, getErrorMessage } from "../pure/helpers-pure";
import { getResults, runQuery } from "./external-api-usage-query";
import { extLogger } from "../common";

export class DataExtensionsEditorView extends AbstractWebview<
  ToDataExtensionsEditorMessage,
  FromDataExtensionsEditorMessage
> {
  public constructor(
    ctx: ExtensionContext,
    private readonly cliServer: CodeQLCliServer,
    private readonly queryRunner: QueryRunner,
    private readonly queryStorageDir: string,
    private readonly databaseItem: DatabaseItem,
  ) {
    super(ctx);
  }

  public async openView() {
    const panel = await this.getPanel();
    panel.reveal(undefined, true);

    await this.waitForPanelLoaded();
  }

  protected async getPanelConfig(): Promise<WebviewPanelConfig> {
    return {
      viewId: "data-extensions-editor",
      title: "Data Extensions Editor",
      viewColumn: ViewColumn.Active,
      preserveFocus: true,
      view: "data-extensions-editor",
    };
  }

  protected onPanelDispose(): void {
    // Nothing to do here
  }

  protected async onMessage(
    msg: FromDataExtensionsEditorMessage,
  ): Promise<void> {
    switch (msg.t) {
      case "viewLoaded":
        await this.onWebViewLoaded();

        break;
      default:
        throw new Error("Unexpected message type");
    }
  }

  protected async onWebViewLoaded() {
    super.onWebViewLoaded();

    await this.loadExternalApiUsages();
  }

  protected async loadExternalApiUsages(): Promise<void> {
    const cancellationTokenSource = new CancellationTokenSource();

    try {
      const queryResult = await runQuery({
        cliServer: this.cliServer,
        queryRunner: this.queryRunner,
        databaseItem: this.databaseItem,
        queryStorageDir: this.queryStorageDir,
        logger: extLogger,
        progress: (progressUpdate: ProgressUpdate) => {
          void this.showProgress(progressUpdate, 1500);
        },
        token: cancellationTokenSource.token,
      });
      if (!queryResult) {
        await this.clearProgress();
        return;
      }

      await this.showProgress({
        message: "Decoding results",
        step: 1100,
        maxStep: 1500,
      });

      const bqrsChunk = await getResults({
        cliServer: this.cliServer,
        bqrsPath: queryResult.outputDir.bqrsPath,
        logger: extLogger,
      });
      if (!bqrsChunk) {
        await this.clearProgress();
        return;
      }

      await this.showProgress({
        message: "Finalizing results",
        step: 1450,
        maxStep: 1500,
      });

      const externalApiUsages = decodeBqrsToExternalApiUsages(bqrsChunk);

      await this.postMessage({
        t: "setExternalApiUsages",
        externalApiUsages,
      });

      await this.clearProgress();
    } catch (err) {
      void showAndLogExceptionWithTelemetry(
        redactableError(
          asError(err),
        )`Failed to load external APi usages: ${getErrorMessage(err)}`,
      );
    }
  }

  private async showProgress(update: ProgressUpdate, maxStep?: number) {
    await this.postMessage({
      t: "showProgress",
      step: update.step,
      maxStep: maxStep ?? update.maxStep,
      message: update.message,
    });
  }

  private async clearProgress() {
    await this.showProgress({
      step: 0,
      maxStep: 0,
      message: "",
    });
  }
}
