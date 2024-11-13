import { execFileSync } from "child_process";
import {
  createWriteStream,
  ensureDir,
  existsSync,
  mkdtempSync,
  move,
  readdirSync,
  readJsonSync,
  remove,
} from "fs-extra";
import path, { basename, join } from "path";
import { Uri, window } from "vscode";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import type { App } from "../common/app";
import { createTimeoutSignal } from "../common/fetch-stream";
import { extLogger } from "../common/logging/vscode";
import type { ProgressCallback } from "../common/vscode/progress";
import { reportStreamProgress, withProgress } from "../common/vscode/progress";
import { downloadTimeout } from "../config";
import { QueryOutputDir } from "../local-queries/query-output-dir";
import { tmpDir } from "../tmp-dir";

type VariantId = string;
type SourceId = string;
type TargetId = string;

export type TargetInfo = {
  target_id: TargetId;
  variant_id: VariantId;
  source_id: SourceId;
};
export type ArtifactDownload = {
  repository: string;
  run_id: number;
  artifact_name: string;
};

export type TargetDownloads = {
  "evaluator-logs": ArtifactDownload;
};

export type MinimalDownloadsType = {
  targets: {
    [target: string]: {
      info: TargetInfo;
      downloads: TargetDownloads;
    };
  };
};

export class RemoteLogs {
  private LOG_DOWNLOAD_AND_PROCESS_PROGRESS_STEPS = 4;
  private PICK_TARGETS_PROGRESS_STEPS = 4;

  constructor(
    private workingDirectory: string,
    private app: App,
    private cliServer: CodeQLCliServer,
  ) {}

  /**
   * Gets the download URL for a single artifact.
   */
  private async getArtifactDownloadUrl(
    artifact: ArtifactDownload,
  ): Promise<{ url: string; bytes: number; id: string }> {
    const client = await this.app.credentials.getOctokit();
    const [owner, repo] = artifact.repository.split("/");
    // convert the artifact name to an id by looking up the artifact by name
    const artifacts = await client.rest.actions.listWorkflowRunArtifacts({
      owner,
      repo,
      run_id: artifact.run_id,
    });
    const match = artifacts.data.artifacts.find(
      (a) => a.name === artifact.artifact_name,
    );
    if (!match) {
      throw new Error(
        `No artifact found with name ${artifact.artifact_name} in ${artifact.repository} run ${artifact.run_id}?!`,
      );
    }
    if (match.expired) {
      throw new Error(`Artifact ${match.id} has expired`);
    }
    const artifact_id = match.id;
    // get the download url for unauthenticated access
    const response = await client.request(
      "HEAD /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}",
      {
        owner,
        repo,
        artifact_id,
        archive_format: "zip",
      },
    );
    return {
      url: response.url,
      bytes: response.headers["content-length"]!,
      id: `artifacts/${owner}/${repo}/${artifact_id}`,
    };
  }

  /**
   * Downloads and processes the logs for a single target.
   *
   * This operation may make use of disk caching.
   *
   * @returns the path to the resulting evaluator summary log
   */
  private async downloadAndProcessLogsForTarget(
    logArtifact: ArtifactDownload,
  ): Promise<string /* log path */ | undefined> {
    const artifactDownloadUrl = await this.getArtifactDownloadUrl(logArtifact);
    const logsPath = path.join(
      this.workingDirectory,
      `logs-of/${artifactDownloadUrl.id}`,
    );
    if (existsSync(logsPath) && readdirSync(logsPath).length > 0) {
      void extLogger.log(
        `Skipping log download and extraction to existing '${logsPath}'...`,
      );
    }
    return await withProgress(
      async (progress) => {
        await this.downloadLogsForTarget(
          artifactDownloadUrl,
          logsPath,
          progress,
        );
        progress?.({
          step: 4,
          maxStep: this.LOG_DOWNLOAD_AND_PROCESS_PROGRESS_STEPS,
          message: `Generating evaluator summary log...`,
        });
        const summaryLog = await this.processLogsForTarget(logsPath);
        // finally, return the path to the evaluator summary log, which is all we need downstream
        return summaryLog;
      },
      {
        title: `Downloading and processing remote evaluator logs (${(artifactDownloadUrl.bytes / 1024 / 1024).toFixed(1)} MB}`,
      },
    );
  }

  /**
   * Processes the logs for a single target.
   */
  private async processLogsForTarget(logsDirectory: string) {
    const logsPathDirStructure = new QueryOutputDir(logsDirectory);
    const summaryLog = logsPathDirStructure.jsonEvalLogSummaryPath;
    if (existsSync(summaryLog)) {
      void extLogger.log(
        `Skipping log summary generation to existing '${summaryLog}'...`,
      );
    } else {
      // find the lone file in the untarred directory which presumably is completely fresh
      const filesInDir = readdirSync(logsDirectory);
      const firstFileInDir = filesInDir[0];
      if (filesInDir.length !== 1) {
        throw new Error(
          `Inconsistent disk state: Expected exactly one file in the untarred directory (${logsDirectory}), but found: ${filesInDir.join(
            ", ",
          )}`,
        );
      }
      const rawEvaluatorLog = path.join(logsDirectory, firstFileInDir);
      if (rawEvaluatorLog !== logsPathDirStructure.evalLogPath) {
        // rename the json file to the standard name
        await move(rawEvaluatorLog, logsPathDirStructure.evalLogPath);
      }
      await this.cliServer.generateJsonLogSummary(
        logsPathDirStructure.evalLogPath,
        summaryLog,
      );
    }
    // assert that the summary file exists by now
    if (!existsSync(summaryLog)) {
      throw new Error(
        `Expected a summary file at ${summaryLog}, but none was found.`,
      );
    }
    return summaryLog;
  }

  /**
   * Downloads the logs for a single target.
   */
  private async downloadLogsForTarget(
    artifactDownloadUrl: { url: string; bytes: number; id: string },
    downloadDir: string,
    progress: ProgressCallback,
  ) {
    const { url, bytes, id: artifactDiskId } = artifactDownloadUrl;
    const downloadPath = path.join(this.workingDirectory, artifactDiskId);
    if (existsSync(downloadPath) && readdirSync(downloadPath).length > 0) {
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
    if (existsSync(downloadDir) && readdirSync(downloadDir).length > 0) {
      void extLogger.log(
        `Skipping log extraction to existing '${downloadDir}'...`,
      );
    } else {
      await ensureDir(downloadDir);
      // find the lone tar.gz file in the unzipped directory
      const unzippedFiles = readdirSync(downloadPath);
      const tarGzFiles = unzippedFiles.filter((f) => f.endsWith(".tar.gz"));
      if (tarGzFiles.length !== 1) {
        throw new Error(
          `Expected exactly one .tar.gz file in the unzipped directory, but found: ${tarGzFiles.join(
            ", ",
          )}`,
        );
      }
      await this.untargz(
        path.join(downloadPath, tarGzFiles[0]),
        downloadDir,
        progress,
      );
    }
  }

  /**
   * Produces a pair of paths to the evaluator summary logs.
   *
   * The operations in here are expensive wrt. bandwidth, disk space and compute time.
   * But they make heavy use of disk caching to avoid re-downloading and re-processing the same data.
   *
   * This is achieved by:
   *
   * - prompt the user to pick an experiment
   * - download metadata for the experiment
   * - prompt the user to pick two two targets
   * - in parallel for each target:
   *   - download the logs
   *   - process the logs to evaluator summary logs
   * - return the paths to the evaluator summary logs
   */
  public async downloadAndProcess(): Promise<
    | {
        before: string;
        after: string;
      }
    | undefined
  > {
    const picked = await withProgress((p) => this.pickTargets(p));
    if (!picked) {
      void extLogger.log("No targets picked, aborting download");
      return undefined;
    }
    const processed = await Promise.all([
      this.downloadAndProcessLogsForTarget(picked.before),
      this.downloadAndProcessLogsForTarget(picked.after),
    ]);

    if (processed.some((d) => typeof d === "undefined")) {
      throw new Error("Silently failed to download or process some logs!?");
    }
    return { before: processed[0]!, after: processed[1]! };
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
      maxStep: this.LOG_DOWNLOAD_AND_PROCESS_PROGRESS_STEPS,
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
      maxStep: this.LOG_DOWNLOAD_AND_PROCESS_PROGRESS_STEPS,
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
      maxStep: this.LOG_DOWNLOAD_AND_PROCESS_PROGRESS_STEPS,
      step: 3,
      message: `Untarring into ${basename(untarPath)}`,
    });
    void extLogger.log(`Untarring ${tarballPath} into ${untarPath}`);
    execFileSync("tar", ["-xzf", tarballPath, "-C", untarPath]);
  }

  private async getPotentialTargetInfos(
    experimentName: string,
  ): Promise<Array<MinimalDownloadsType["targets"]["string"]>> {
    const dir = mkdtempSync(
      path.join(tmpDir.name, "codeql-compare-performance"),
    );
    const tasksDir = join(dir, "tasks");
    await ensureDir(tasksDir);
    // XXX hardcoded path
    const dca = "/Users/esbena/Documents/codeql-dca/dca";
    const config = "/Users/esbena/Documents/codeql-dca/dca-config.yml";
    execFileSync(dca, [
      "tasks-remote",
      "--config",
      config,
      "--mode",
      "get-tasks",
      "--name",
      experimentName,
      "--dir",
      dir,
    ]);
    const downloadsFile = join(dir, "downloads.json");
    execFileSync(dca, [
      "tasks-show",
      "--config",
      config,
      "--mode",
      "downloads",
      "--output",
      downloadsFile,
      "--dir",
      dir,
    ]);
    const downloads = readJsonSync(downloadsFile) as MinimalDownloadsType;
    void extLogger.log(
      `Found ${Object.keys(downloads.targets).length} potential targets in experiment ${experimentName}`,
    );
    return Object.values(downloads.targets);
  }

  private async pickTargets(progress?: ProgressCallback): Promise<
    | {
        before: ArtifactDownload;
        after: ArtifactDownload;
      }
    | undefined
  > {
    progress?.({
      message: "Picking experiment",
      step: 1,
      maxStep: this.PICK_TARGETS_PROGRESS_STEPS,
    });

    const experimentChoice = await window.showInputBox({
      title: `Enter an experiment name`,
      placeHolder: "esbena/pr-17968-6d8ef2__nightly__nightly__1",
      ignoreFocusOut: true,
    });

    if (!experimentChoice) {
      return undefined;
    }

    progress?.({
      message: `Downloading data from experiment ${experimentChoice}`,
      step: 2,
      maxStep: this.PICK_TARGETS_PROGRESS_STEPS,
    });
    const targetInfos = await this.getPotentialTargetInfos(experimentChoice);

    progress?.({
      message: "Picking target 1/2",
      step: 3,
      maxStep: this.PICK_TARGETS_PROGRESS_STEPS,
    });
    const targetChoice1 = await window.showQuickPick(
      targetInfos.map((t) => t.info.target_id),
      {
        title: `Pick target 1`,
        ignoreFocusOut: true,
      },
    );
    if (!targetChoice1) {
      return undefined;
    }
    const targetInfoChoice1 = targetInfos.find(
      (t) => t.info.target_id === targetChoice1,
    )!;
    progress?.({
      message: "Picking target 2/2",
      step: 4,
      maxStep: this.PICK_TARGETS_PROGRESS_STEPS,
    });
    const targetChoice2 = await window.showQuickPick(
      targetInfos
        .filter(
          (t) =>
            t.info.target_id !== targetChoice1 &&
            // XXX opinionated picking that might be too limiting in the edge cases:
            // - same source
            // - different variant
            t.info.source_id === targetInfoChoice1.info.source_id &&
            t.info.variant_id !== targetInfoChoice1.info.variant_id,
        )
        .map((t) => t.info.target_id),
      {
        title: `Pick target 2`,
        ignoreFocusOut: true,
      },
    );
    if (!targetChoice2) {
      return undefined;
    }
    void extLogger.log(
      `Picked ${experimentChoice} ${targetChoice1} ${targetChoice2}`,
    );
    return {
      before: targetInfoChoice1.downloads["evaluator-logs"],
      after: targetInfos.find((t) => t.info.target_id === targetChoice2)!
        .downloads["evaluator-logs"],
    };
  }
}
