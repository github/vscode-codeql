import { CancellationTokenSource, ExtensionContext, ViewColumn } from "vscode";
import { AbstractWebview, WebviewPanelConfig } from "../abstract-webview";
import {
  FromDataExtensionsEditorMessage,
  ToDataExtensionsEditorMessage,
} from "../pure/interface-types";
import { ProgressUpdate } from "../progress";
import { extLogger, TeeLogger } from "../common";
import { CoreCompletedQuery, QueryRunner } from "../queryRunner";
import { qlpackOfDatabase } from "../contextual/queryResolver";
import { file } from "tmp-promise";
import { writeFile } from "fs-extra";
import { dump } from "js-yaml";
import { getOnDiskWorkspaceFolders } from "../helpers";
import { DatabaseItem } from "../local-databases";
import { CodeQLCliServer } from "../cli";
import { decodeBqrsToExternalApiUsages } from "./bqrs";

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
    const queryResult = await this.runQuery();
    if (!queryResult) {
      await this.clearProgress();
      return;
    }

    await this.showProgress({
      message: "Loading results",
      step: 1100,
      maxStep: 1500,
    });

    const bqrsPath = queryResult.outputDir.bqrsPath;

    const bqrsChunk = await this.getResults(bqrsPath);
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
  }

  private async runQuery(): Promise<CoreCompletedQuery | undefined> {
    const qlpacks = await qlpackOfDatabase(this.cliServer, this.databaseItem);

    const packsToSearch = [qlpacks.dbschemePack];
    if (qlpacks.queryPack) {
      packsToSearch.push(qlpacks.queryPack);
    }

    const suiteFile = (
      await file({
        postfix: ".qls",
      })
    ).path;
    const suiteYaml = [];
    for (const qlpack of packsToSearch) {
      suiteYaml.push({
        from: qlpack,
        queries: ".",
        include: {
          id: `${this.databaseItem.language}/telemetry/fetch-external-apis`,
        },
      });
    }
    await writeFile(suiteFile, dump(suiteYaml), "utf8");

    const queries = await this.cliServer.resolveQueriesInSuite(
      suiteFile,
      getOnDiskWorkspaceFolders(),
    );

    if (queries.length !== 1) {
      void extLogger.log(`Expected exactly one query, got ${queries.length}`);
      return;
    }

    const query = queries[0];

    const tokenSource = new CancellationTokenSource();

    const queryRun = this.queryRunner.createQueryRun(
      this.databaseItem.databaseUri.fsPath,
      { queryPath: query, quickEvalPosition: undefined },
      false,
      getOnDiskWorkspaceFolders(),
      undefined,
      this.queryStorageDir,
      undefined,
      undefined,
    );

    return queryRun.evaluate(
      (update) => this.showProgress(update, 1500),
      tokenSource.token,
      new TeeLogger(this.queryRunner.logger, queryRun.outputDir.logPath),
    );
  }

  private async getResults(bqrsPath: string) {
    const bqrsInfo = await this.cliServer.bqrsInfo(bqrsPath);
    if (bqrsInfo["result-sets"].length !== 1) {
      void extLogger.log(
        `Expected exactly one result set, got ${bqrsInfo["result-sets"].length}`,
      );
      return undefined;
    }

    const resultSet = bqrsInfo["result-sets"][0];

    await this.showProgress({
      message: "Decoding results",
      step: 1200,
      maxStep: 1500,
    });

    return this.cliServer.bqrsDecode(bqrsPath, resultSet.name);
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
