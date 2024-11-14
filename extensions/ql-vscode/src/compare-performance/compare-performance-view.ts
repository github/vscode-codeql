import { execFileSync } from "child_process";
import {
  createWriteStream,
  ensureDir,
  existsSync,
  readdirSync,
  remove,
} from "fs-extra";
import path, { basename, join } from "path";
import { Uri, ViewColumn } from "vscode";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import type { App } from "../common/app";
import { redactableError } from "../common/errors";
import { createTimeoutSignal } from "../common/fetch-stream";
import type {
  FromComparePerformanceViewMessage,
  ToComparePerformanceViewMessage,
} from "../common/interface-types";
import type { Logger } from "../common/logging";
import { showAndLogExceptionWithTelemetry } from "../common/logging";
import { extLogger } from "../common/logging/vscode";
import type { WebviewPanelConfig } from "../common/vscode/abstract-webview";
import { AbstractWebview } from "../common/vscode/abstract-webview";
import type { ProgressCallback } from "../common/vscode/progress";
import { reportStreamProgress, withProgress } from "../common/vscode/progress";
import { telemetryListener } from "../common/vscode/telemetry";
import { downloadTimeout } from "../config";
import type { ResultsView } from "../local-queries";
import { scanLog } from "../log-insights/log-scanner";
import { PerformanceOverviewScanner } from "../log-insights/performance-comparison";
import type { HistoryItemLabelProvider } from "../query-history/history-item-label-provider";
import { tmpDir } from "../tmp-dir";

type ComparePerformanceCommands = {
  "codeQL.compare-performance.downloadExternalLogs": () => Promise<void>;
};

export class ComparePerformanceView extends AbstractWebview<
  ToComparePerformanceViewMessage,
  FromComparePerformanceViewMessage
> {
  private workingDirectory;
  private LOG_DOWNLOAD_PROGRESS_STEPS = 3;

  constructor(
    app: App,
    public cliServer: CodeQLCliServer, // TODO: make private
    public logger: Logger,
    public labelProvider: HistoryItemLabelProvider,
    private resultsView: ResultsView,
  ) {
    super(app);
    this.workingDirectory = path.join(
      app.globalStoragePath,
      "compare-performance",
    );
  }

  async showResults(fromJsonLog: string, toJsonLog: string) {
    const panel = await this.getPanel();
    panel.reveal(undefined, false);

    // Close the results viewer as it will have opened when the user clicked the query in the history view
    // (which they must do as part of the UI interaction for opening the performance view).
    // The performance view generally needs a lot of width so it's annoying to have the result viewer open.
    this.resultsView.hidePanel();

    await this.waitForPanelLoaded();

    // TODO: try processing in (async) parallel once readJsonl is streaming
    const fromPerf = await scanLog(
      fromJsonLog,
      new PerformanceOverviewScanner(),
    );
    const toPerf = await scanLog(toJsonLog, new PerformanceOverviewScanner());

    // TODO: filter out irrelevant common predicates before transfer?

    await this.postMessage({
      t: "setPerformanceComparison",
      from: fromPerf.getData(),
      to: toPerf.getData(),
    });
  }

  protected getPanelConfig(): WebviewPanelConfig {
    return {
      viewId: "comparePerformanceView",
      title: "Compare CodeQL Performance",
      viewColumn: ViewColumn.Active,
      preserveFocus: true,
      view: "compare-performance",
    };
  }

  protected onPanelDispose(): void {}

  protected async onMessage(
    msg: FromComparePerformanceViewMessage,
  ): Promise<void> {
    switch (msg.t) {
      case "viewLoaded":
        this.onWebViewLoaded();
        break;

      case "telemetry":
        telemetryListener?.sendUIInteraction(msg.action);
        break;

      case "unhandledError":
        void showAndLogExceptionWithTelemetry(
          extLogger,
          telemetryListener,
          redactableError(
            msg.error,
          )`Unhandled error in performance comparison view: ${msg.error.message}`,
        );
        break;
    }
  }

  async downloadExternalLogs(): Promise<void> {
    const client = await this.app.credentials.getOctokit();
    async function getArtifactDownloadUrl(
      url: string,
    ): Promise<{ url: string; bytes: number; id: string }> {
      const pattern =
        /https:\/\/github.com\/([^/]+)\/([^/]+)\/actions\/runs\/([^/]+)\/artifacts\/([^/]+)/;
      const match = url.match(pattern);
      if (!match) {
        throw new Error(`Invalid artifact URL: ${url}`);
      }
      const [, owner, repo, , artifact_id] = match;
      const response = await client.request(
        "HEAD /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}",
        {
          owner,
          repo,
          artifact_id,
          archive_format: "zip",
        },
      );
      if (!response.headers["content-length"]) {
        throw new Error(
          `No content-length header found for artifact URL: ${url}`,
        );
      }
      return {
        url: response.url,
        bytes: response.headers["content-length"],
        id: `artifacts/${owner}/${repo}/${artifact_id}`,
      };
    }

    const downloadLog = async (originalUrl: string) => {
      const {
        url,
        bytes,
        id: artifactDiskId,
      } = await getArtifactDownloadUrl(originalUrl);
      const logPath = path.join(
        this.workingDirectory,
        `logs-of/${artifactDiskId}`,
      );
      if (existsSync(logPath) && readdirSync(logPath).length > 0) {
        void extLogger.log(
          `Skipping log download and extraction to existing '${logPath}'...`,
        );
      }
      await withProgress(
        async (progress) => {
          const downloadPath = path.join(this.workingDirectory, artifactDiskId);
          if (
            existsSync(downloadPath) &&
            readdirSync(downloadPath).length > 0
          ) {
            void extLogger.log(
              `Skipping download to existing '${artifactDiskId}'...`,
            );
          } else {
            await ensureDir(downloadPath);
            void extLogger.log(
              `Downloading from ${artifactDiskId} (bytes: ${bytes}) ${downloadPath}...`,
            );
            await this.fetchAndUnzip(url, downloadPath, progress);
          }
          if (existsSync(logPath) && readdirSync(logPath).length > 0) {
            void extLogger.log(
              `Skipping log extraction to existing '${logPath}'...`,
            );
          } else {
            await ensureDir(logPath);
            // find the lone tar.gz file in the unzipped directory
            const unzippedFiles = readdirSync(downloadPath);
            const tarGzFiles = unzippedFiles.filter((f) =>
              f.endsWith(".tar.gz"),
            );
            if (tarGzFiles.length !== 1) {
              throw new Error(
                `Expected exactly one .tar.gz file in the unzipped directory, but found: ${tarGzFiles.join(
                  ", ",
                )}`,
              );
            }
            await this.untargz(
              path.join(downloadPath, tarGzFiles[0]),
              logPath,
              progress,
            );
          }
        },
        {
          title: `Downloading evaluator logs (${(bytes / 1024 / 1024).toFixed(1)} MB}`,
        },
      );
    };
    // hardcoded URLs from https://github.com/codeql-dca-runners/codeql-dca-worker_javascript/actions/runs/11816721194
    const url1 =
      "https://github.com/codeql-dca-runners/codeql-dca-worker_javascript/actions/runs/11816721194/artifacts/2181621080";
    const url2 =
      "https://github.com/codeql-dca-runners/codeql-dca-worker_javascript/actions/runs/11816721194/artifacts/2181601861";

    await Promise.all([downloadLog(url1), downloadLog(url2)]);
    void extLogger.log(`Downloaded logs to ${this.workingDirectory}`);

    return;
  }

  /**
   * XXX Almost identical copy of the one in `database-fetcher.ts`.
   * There ought to be a generic `downloadArtifactOrSimilar`
   */
  private async fetchAndUnzip(
    contentUrl: string,
    // (see below) requestHeaders: { [key: string]: string },
    unzipPath: string,
    progress?: ProgressCallback,
  ) {
    // Although it is possible to download and stream directly to an unzipped directory,
    // we need to avoid this for two reasons. The central directory is located at the
    // end of the zip file. It is the source of truth of the content locations. Individual
    // file headers may be incorrect. Additionally, saving to file first will reduce memory
    // pressure compared with unzipping while downloading the archive.

    const archivePath = join(tmpDir.name, `archive-${Date.now()}.zip`);

    progress?.({
      maxStep: this.LOG_DOWNLOAD_PROGRESS_STEPS,
      message: "Downloading content",
      step: 1,
    });

    const {
      signal,
      onData,
      dispose: disposeTimeout,
    } = createTimeoutSignal(downloadTimeout());

    let response: Response;
    try {
      response = await this.checkForFailingResponse(
        await fetch(contentUrl, {
          // XXX disabled header forwarding headers: requestHeaders,
          signal,
        }),
        "Error downloading content",
      );
    } catch (e) {
      disposeTimeout();

      if (e instanceof DOMException && e.name === "AbortError") {
        const thrownError = new Error("The request timed out.");
        thrownError.stack = e.stack;
        throw thrownError;
      }

      throw e;
    }

    const body = response.body;
    if (!body) {
      throw new Error("No response body found");
    }

    const archiveFileStream = createWriteStream(archivePath);

    const contentLength = response.headers.get("content-length");
    const totalNumBytes = contentLength
      ? parseInt(contentLength, 10)
      : undefined;

    const reportProgress = reportStreamProgress(
      "Downloading log",
      totalNumBytes,
      progress,
    );

    try {
      const reader = body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        onData();
        reportProgress(value?.length ?? 0);

        await new Promise((resolve, reject) => {
          archiveFileStream.write(value, (err) => {
            if (err) {
              reject(err);
            }
            resolve(undefined);
          });
        });
      }

      await new Promise((resolve, reject) => {
        archiveFileStream.close((err) => {
          if (err) {
            reject(err);
          }
          resolve(undefined);
        });
      });
    } catch (e) {
      // Close and remove the file if an error occurs
      archiveFileStream.close(() => {
        void remove(archivePath);
      });

      if (e instanceof DOMException && e.name === "AbortError") {
        const thrownError = new Error("The download timed out.");
        thrownError.stack = e.stack;
        throw thrownError;
      }

      throw e;
    } finally {
      disposeTimeout();
    }

    await this.readAndUnzip(
      Uri.file(archivePath).toString(true),
      unzipPath,
      progress,
    );

    // remove archivePath eagerly since these archives can be large.
    await remove(archivePath);
  }

  private async checkForFailingResponse(
    response: Response,
    errorMessage: string,
  ): Promise<Response | never> {
    if (response.ok) {
      return response;
    }

    // An error downloading the content. Attempt to extract the reason behind it.
    const text = await response.text();
    let msg: string;
    try {
      const obj = JSON.parse(text);
      msg =
        obj.error || obj.message || obj.reason || JSON.stringify(obj, null, 2);
    } catch {
      msg = text;
    }
    throw new Error(`${errorMessage}.\n\nReason: ${msg}`);
  }

  private async readAndUnzip(
    zipUrl: string,
    unzipPath: string,
    progress?: ProgressCallback,
  ) {
    const zipFile = Uri.parse(zipUrl).fsPath;
    progress?.({
      maxStep: this.LOG_DOWNLOAD_PROGRESS_STEPS,
      step: 2,
      message: `Unzipping into ${basename(unzipPath)}`,
    });
    execFileSync("unzip", ["-q", "-d", unzipPath, zipFile]);
  }

  private async untargz(
    tarballPath: string,
    untarPath: string,
    progress?: ProgressCallback,
  ) {
    progress?.({
      maxStep: this.LOG_DOWNLOAD_PROGRESS_STEPS,
      step: 3,
      message: `Untarring into ${basename(untarPath)}`,
    });
    void extLogger.log(`Untarring ${tarballPath} into ${untarPath}`);
    execFileSync("tar", ["-xzf", tarballPath, "-C", untarPath]);
  }

  public getCommands(): ComparePerformanceCommands {
    return {
      "codeQL.compare-performance.downloadExternalLogs":
        this.downloadExternalLogs.bind(this),
    };
  }
}
