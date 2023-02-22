import { CancellationTokenSource, ExtensionContext, ViewColumn } from "vscode";
import { AbstractWebview, WebviewPanelConfig } from "../abstract-webview";
import {
  FromExternalApiMessage,
  ToExternalApiMessage,
} from "../pure/interface-types";
import { qlpackOfDatabase } from "../contextual/queryResolver";
import { CodeQLCliServer } from "../cli";
import { file } from "tmp-promise";
import { writeFile } from "fs-extra";
import { dump } from "js-yaml";
import { getOnDiskWorkspaceFolders } from "../helpers";
import { extLogger, TeeLogger } from "../common";
import { DatabaseManager } from "../local-databases";
import { CoreCompletedQuery, QueryRunner } from "../queryRunner";

export class ExternalApiView extends AbstractWebview<
  ToExternalApiMessage,
  FromExternalApiMessage
> {
  public constructor(
    ctx: ExtensionContext,
    private readonly databaseManager: DatabaseManager,
    private readonly cliServer: CodeQLCliServer,
    private readonly queryRunner: QueryRunner,
    private readonly queryStorageDir: string,
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
      viewId: "external-api-view",
      title: "lol",
      viewColumn: ViewColumn.Active,
      preserveFocus: true,
      view: "external-api",
    };
  }

  protected onPanelDispose(): void {
    // Nothing to do here
  }

  protected async onMessage(msg: FromExternalApiMessage): Promise<void> {
    switch (msg.t) {
      case "viewLoaded":
        await this.onWebViewLoaded();

        break;
      default:
        throw new Error("Unknown message type");
    }
  }

  protected async onWebViewLoaded() {
    super.onWebViewLoaded();

    const queryResult = await this.runQuery();
    if (!queryResult) {
      return;
    }

    void extLogger.log(`Query result: ${JSON.stringify(queryResult)}`);

    const bqrsPath = queryResult.outputDir.bqrsPath;

    void extLogger.log(`BQRS path: ${bqrsPath}`);

    const results = await this.getResults(bqrsPath);
    if (!results) {
      return;
    }

    void extLogger.log(`Results: ${JSON.stringify(results)}`);

    await this.postMessage({
      t: "setExternalApiRepoResults",
      results,
    });
  }

  private async runQuery(): Promise<CoreCompletedQuery | undefined> {
    const db = this.databaseManager.currentDatabaseItem;
    if (!db) {
      void extLogger.log("No database selected");
      return undefined;
    }

    const qlpacks = await qlpackOfDatabase(this.cliServer, db);

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
          kind: "metric",
          id: `${db.language}/telemetry/unsupported-external-api`,
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
      db.databaseUri.fsPath,
      { queryPath: query, quickEvalPosition: undefined },
      false,
      getOnDiskWorkspaceFolders(),
      undefined,
      this.queryStorageDir,
      undefined,
      undefined,
    );

    return queryRun.evaluate(
      () => void 0,
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

    return this.cliServer.bqrsDecode(bqrsPath, resultSet.name);
  }
}
