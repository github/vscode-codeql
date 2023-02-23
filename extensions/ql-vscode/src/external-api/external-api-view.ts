import {
  CancellationTokenSource,
  ExtensionContext,
  Uri,
  ViewColumn,
  window as Window,
  workspace,
} from "vscode";
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
import { extLogger } from "../common";
import { DatabaseManager } from "../local-databases";
import { QueryRunner } from "../queryRunner";
import {
  createInitialQueryInfo,
  QueryWithResults,
} from "../run-queries-shared";
import { assertNever } from "../pure/helpers-pure";
import { ResolvableLocationValue } from "../pure/bqrs-cli-types";
import { showResolvableLocation } from "../interface-utils";

export class ExternalApiView extends AbstractWebview<
  ToExternalApiMessage,
  FromExternalApiMessage
> {
  public constructor(
    ctx: ExtensionContext,
    private readonly cli: CodeQLCliServer,
    private readonly databaseManager: DatabaseManager,
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
      title: "External API usage",
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
      case "applyDataExtensionYaml":
        await this.saveYaml(msg.yaml);
        await this.loadExternalApiUsages();

        break;
      case "jumpToUsage":
        await this.jumpToUsage(msg.location);

        break;
      default:
        assertNever(msg);
    }
  }

  protected async onWebViewLoaded() {
    super.onWebViewLoaded();

    await this.loadExternalApiUsages();
  }

  protected async saveYaml(yaml: string): Promise<void> {
    void extLogger.log(`Saving data extension YAML: ${yaml}`);

    const workspaceFolder = workspace.workspaceFolders?.find(
      (folder) => folder.name === "ql",
    );
    if (!workspaceFolder) {
      void extLogger.log("No workspace folder 'ql' found");

      return;
    }

    const path = Uri.joinPath(
      workspaceFolder.uri,
      "java/ql/lib/ext/vscode.model.yml",
    ).fsPath;

    await writeFile(path, yaml);

    void extLogger.log(`Saved data extension YAML to ${path}`);
  }

  protected async jumpToUsage(
    location: ResolvableLocationValue,
  ): Promise<void> {
    const db = this.databaseManager.currentDatabaseItem;
    if (!db) {
      void extLogger.log("No database selected");
      return undefined;
    }

    try {
      await showResolvableLocation(location, db);
    } catch (e) {
      if (e instanceof Error) {
        if (e.message.match(/File not found/)) {
          void Window.showErrorMessage(
            "Original file of this result is not in the database's source archive.",
          );
        } else {
          void extLogger.log(`Unable to handleMsgFromView: ${e.message}`);
        }
      } else {
        void extLogger.log(`Unable to handleMsgFromView: ${e}`);
      }
    }
  }

  protected async loadExternalApiUsages(): Promise<void> {
    const queryResult = await this.runQuery();
    if (!queryResult) {
      return;
    }

    void extLogger.log(`Query result: ${JSON.stringify(queryResult)}`);

    const bqrsPath = queryResult.query.resultsPaths.resultsPath;

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

  private async runQuery(): Promise<QueryWithResults | undefined> {
    const db = this.databaseManager.currentDatabaseItem;
    if (!db) {
      void extLogger.log("No database selected");
      return undefined;
    }

    const qlpacks = await qlpackOfDatabase(this.cli, db);

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
          id: `${db.language}/telemetry/fetch-external-apis`,
        },
      });
    }
    await writeFile(suiteFile, dump(suiteYaml), "utf8");

    const queries = await this.cli.resolveQueriesInSuite(
      suiteFile,
      getOnDiskWorkspaceFolders(),
    );

    if (queries.length !== 1) {
      void extLogger.log(`Expected exactly one query, got ${queries.length}`);
      return;
    }

    const query = queries[0];

    const initialInfo = await createInitialQueryInfo(
      Uri.file(query),
      {
        name: db.name,
        databaseUri: db.databaseUri.toString(),
      },
      false,
    );

    const tokenSource = new CancellationTokenSource();

    return this.queryRunner.compileAndRunQueryAgainstDatabase(
      db,
      initialInfo,
      this.queryStorageDir,
      () => void 0,
      tokenSource.token,
    );
  }

  private async getResults(bqrsPath: string) {
    const bqrsInfo = await this.cli.bqrsInfo(bqrsPath);
    if (bqrsInfo["result-sets"].length !== 1) {
      void extLogger.log(
        `Expected exactly one result set, got ${bqrsInfo["result-sets"].length}`,
      );
      return undefined;
    }

    const resultSet = bqrsInfo["result-sets"][0];

    return this.cli.bqrsDecode(bqrsPath, resultSet.name);
  }
}
