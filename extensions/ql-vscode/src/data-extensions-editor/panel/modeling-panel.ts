import { DisposableObject } from "../../common/disposable-object";
import { ModelingFileDecorationProvider } from "./modeling-file-decoration-provider";
import {
  CancellationTokenSource,
  Event,
  EventEmitter,
  TreeView,
  Uri,
  window,
} from "vscode";
import { ModelingTreeDataProvider } from "./modeling-tree-data-provider";
import { ModelingTreeItem } from "./modeling-tree-item";
import { ExternalApiUsage } from "../external-api-usage";
import { DatabaseManager } from "../../databases/local-databases";
import { readQueryResults, runQuery } from "../external-api-usage-query";
import { decodeBqrsToExternalApiUsages } from "../bqrs";
import { showAndLogExceptionWithTelemetry } from "../../common/logging";
import { redactableError } from "../../common/errors";
import { asError, getErrorMessage } from "../../common/helpers-pure";
import { App } from "../../common/app";
import { CodeQLCliServer } from "../../codeql-cli/cli";
import { QueryRunner } from "../../query-server";
import { pluralize } from "../../common/word";
import { ExternalApiUsageProvider } from "./external-api-usage-provider";
import { ModelingCommands } from "../../common/commands";
import {
  ResolvableLocationValue,
  WholeFileLocation,
} from "../../common/bqrs-cli-types";
import { showResolvableLocation } from "../../databases/local-databases/locations";

export class ModelingPanel
  extends DisposableObject
  implements ExternalApiUsageProvider
{
  private _externalApiUsages: ExternalApiUsage[] = [];
  private currentLoadExternalApiUsages: Promise<void> | undefined;
  private readonly _onDidChangeExternalApiUsages = this.push(
    new EventEmitter<void>(),
  );

  private readonly treeDataProvider: ModelingTreeDataProvider;
  private readonly treeView: TreeView<ModelingTreeItem>;

  constructor(
    private readonly app: App,
    private readonly databaseManager: DatabaseManager,
    private readonly cliServer: CodeQLCliServer,
    private readonly queryRunner: QueryRunner,
    private readonly queryStorageDir: string,
  ) {
    super();

    const fileDecorationProvider = new ModelingFileDecorationProvider(this);
    this.push(fileDecorationProvider);

    this.push(window.registerFileDecorationProvider(fileDecorationProvider));

    this.treeDataProvider = new ModelingTreeDataProvider(this);
    this.push(this.treeDataProvider);

    this.treeView = window.createTreeView<ModelingTreeItem>("codeQLModeling", {
      treeDataProvider: this.treeDataProvider,
    });
    this.push(this.treeView);

    databaseManager.onDidChangeCurrentDatabaseItem(() => {
      this._externalApiUsages = [];
      this.updateUI();
      void this.loadExternalApiUsages();
    });

    void this.loadExternalApiUsages();
  }

  public get externalApiUsages(): ReadonlyArray<Readonly<ExternalApiUsage>> {
    return this._externalApiUsages;
  }

  public get onDidChangeExternalApiUsages(): Event<void> {
    return this._onDidChangeExternalApiUsages.event;
  }

  public getCommands(): ModelingCommands {
    return {
      "codeQLModeling.itemClicked": async (uri: Uri) => {
        if (uri.scheme !== "codeql-modeling") {
          return;
        }

        if (uri.authority === "usage") {
          const query = new URLSearchParams(uri.query);

          let location: ResolvableLocationValue;
          if (query.has("startLine")) {
            location = {
              uri: decodeURIComponent(query.get("uri")!),
              startLine: parseInt(query.get("startLine")!),
              startColumn: parseInt(query.get("startColumn")!),
              endLine: parseInt(query.get("endLine")!),
              endColumn: parseInt(query.get("endColumn")!),
            };
          } else {
            location = {
              uri: decodeURIComponent(query.get("uri")!),
            } as WholeFileLocation;
          }

          if (!this.databaseManager.currentDatabaseItem) {
            return;
          }

          try {
            await showResolvableLocation(
              location,
              this.databaseManager.currentDatabaseItem,
            );
          } catch (e) {
            if (e instanceof Error && e.message.match(/File not found/)) {
              void window.showErrorMessage(
                "Original file of this result is not in the database's source archive.",
              );
            } else {
              void this.app.logger.log(
                `Unable to open usage: ${getErrorMessage(e)}`,
              );
            }
          }
        }
      },
    };
  }

  private updateUI(): void {
    const unsupportedExternalApiUsages = this._externalApiUsages.filter(
      (usage) => !usage.supported,
    );

    if (unsupportedExternalApiUsages.length === 0) {
      this.treeView.badge = undefined;
    } else {
      this.treeView.badge = {
        value: unsupportedExternalApiUsages.length,
        tooltip: `${pluralize(
          unsupportedExternalApiUsages.length,
          "unmodeled method",
          "unmodeled methods",
        )}`,
      };
    }

    this._onDidChangeExternalApiUsages.fire();
  }

  private async loadExternalApiUsages(): Promise<void> {
    // First wait for any existing load to complete
    if (this.currentLoadExternalApiUsages) {
      await this.currentLoadExternalApiUsages;
    }

    // Then start a new load
    this.currentLoadExternalApiUsages = this._loadExternalApiUsages()?.finally(
      () => (this.currentLoadExternalApiUsages = undefined),
    );
    await this.currentLoadExternalApiUsages;
  }

  private async _loadExternalApiUsages(): Promise<void> {
    const cancellationTokenSource = new CancellationTokenSource();

    const databaseItem = this.databaseManager.currentDatabaseItem;
    if (!databaseItem) {
      this._externalApiUsages = [];
      this.updateUI();
      return;
    }

    try {
      const queryResult = await runQuery({
        cliServer: this.cliServer,
        queryRunner: this.queryRunner,
        databaseItem,
        queryStorageDir: this.queryStorageDir,
        progress: () => void 0,
        token: cancellationTokenSource.token,
      });
      if (!queryResult) {
        return;
      }

      const bqrsChunk = await readQueryResults({
        cliServer: this.cliServer,
        bqrsPath: queryResult.outputDir.bqrsPath,
      });
      if (!bqrsChunk) {
        return;
      }

      this._externalApiUsages = decodeBqrsToExternalApiUsages(bqrsChunk);

      this.updateUI();
    } catch (err) {
      void showAndLogExceptionWithTelemetry(
        this.app.logger,
        this.app.telemetry,
        redactableError(
          asError(err),
        )`Failed to load external API usages: ${getErrorMessage(err)}`,
      );
    }
  }
}
