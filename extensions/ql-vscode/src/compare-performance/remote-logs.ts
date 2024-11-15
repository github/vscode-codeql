import { execFileSync } from "child_process";
import { rmSync } from "fs";
import {
  createWriteStream,
  ensureDir,
  existsSync,
  move,
  readdirSync,
  readJsonSync,
  remove,
  writeFileSync,
} from "fs-extra";
import { basename, dirname, join, relative } from "path";
import { Uri, window, workspace } from "vscode";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import type { App } from "../common/app";
import type { ArtifactDownload, MinimalDownloadsType } from "../common/dca";
import { dcaControllerRepository } from "../common/dca";
import { createTimeoutSignal } from "../common/fetch-stream";
import { extLogger } from "../common/logging/vscode";
import type { ProgressCallback } from "../common/vscode/progress";
import { reportStreamProgress, withProgress } from "../common/vscode/progress";
import { downloadTimeout, GITHUB_URL } from "../config";
import { QueryOutputDir } from "../local-queries/query-output-dir";
import { tmpDir } from "../tmp-dir";
import type { ComparePerformanceDescriptionData } from "../log-insights/performance-comparison";

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
    const logsPath = join(
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
      const rawEvaluatorLog = join(logsDirectory, firstFileInDir);
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
    logsDir: string,
    progress: ProgressCallback,
  ) {
    const { url, bytes, id: artifactDiskId } = artifactDownloadUrl;
    const artifactDownloadPath = join(this.workingDirectory, artifactDiskId);
    if (
      existsSync(artifactDownloadPath) &&
      readdirSync(artifactDownloadPath).length > 0
    ) {
      void extLogger.log(
        `Skipping download to existing '${artifactDiskId}'...`,
      );
    } else {
      await ensureDir(artifactDownloadPath);
      void extLogger.log(
        `Downloading from ${artifactDiskId} (bytes: ${bytes}) ${artifactDownloadPath}...`,
      );
      // this is incredibly unstable in practice: so retry up to 5 times
      // XXX is there no generic retry utility in this project?
      let retry = 0;
      while (retry < 5) {
        try {
          await this.fetchAndUnzip(url, artifactDownloadPath, progress);
          break;
        } catch (e) {
          if (retry >= 5) {
            throw e;
          }
          void extLogger.log(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            `Failed to download and unzip ${artifactDiskId}: ${(e as any).message ?? "no error message"}. Trying again...`,
          );
          rmSync(artifactDownloadPath);
          retry++;
        }
      }
    }
    if (existsSync(logsDir) && readdirSync(logsDir).length > 0) {
      void extLogger.log(`Skipping log extraction to existing '${logsDir}'...`);
    } else {
      await ensureDir(logsDir);
      // find the lone tar.gz file in the unzipped directory
      const unzippedFiles = readdirSync(artifactDownloadPath);
      const tarGzFiles = unzippedFiles.filter((f) => f.endsWith(".tar.gz"));
      if (tarGzFiles.length !== 1) {
        throw new Error(
          `Expected exactly one .tar.gz file in the unzipped directory, but found: ${tarGzFiles.join(
            ", ",
          )}`,
        );
      }
      try {
        await this.untargz(
          join(artifactDownloadPath, tarGzFiles[0]),
          logsDir,
          progress,
        );
      } catch (e) {
        // historically, this is due to corruption of the tarball. Remove it and ask the user to try again.
        await remove(artifactDownloadPath);
        throw new Error(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          `Failed to untar ${tarGzFiles[0]} into ${logsDir}: ${(e as any).message ?? "no error message"}! Please try the command again.`,
        );
      }
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
        description: ComparePerformanceDescriptionData;
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
    return {
      before: processed[0]!,
      after: processed[1]!,
      description: picked.description,
    };
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

  private getDca(): { bin: string; config: string } {
    const dcaDir = workspace.getConfiguration().get("codeql-dca.dir");
    if (typeof dcaDir !== "string") {
      throw new Error(
        'codeql-dca.dir not set in workspace configuration. Can not process remote logs without it. Solution: insert `"codeql-dca.dir": "/Users/esbena/Documents/codeql-dca"` into your `settings.json` and try again.',
      );
    }
    return {
      bin: join(dcaDir, "dca"),
      config: join(dcaDir, "dca-config.yml"),
    };
  }

  private async getPotentialTargetInfos(
    experimentName: string,
  ): Promise<Array<MinimalDownloadsType["targets"]["string"]>> {
    const tasksDir = await this.getTasksForExperiment(experimentName);

    const downloads = await this.getDownloadsFromTasks(tasksDir);
    void extLogger.log(
      `Found ${Object.keys(downloads.targets).length} potential targets in experiment ${experimentName}`,
    );
    return Object.values(downloads.targets);
  }

  /**
   * Gets the "downloads" metadata from a tasks directory.
   */
  private async getDownloadsFromTasks(
    tasksDir: string,
  ): Promise<MinimalDownloadsType> {
    // store the downloads in a fixed location relative to the tasks directory they are resolved from
    // this way we can cache them and avoid recomputing them
    const downloadsFile = join(
      this.workingDirectory,
      "downloads-of",
      relative(this.workingDirectory, tasksDir),
      "downloads.json",
    );
    if (existsSync(downloadsFile)) {
      void extLogger.log(
        `Skipping downloads extraction to existing '${downloadsFile}'...`,
      );
    } else {
      const dca = this.getDca();
      await ensureDir(dirname(downloadsFile));
      void extLogger.log(
        `Extracting downloads to ${downloadsFile} from ${tasksDir}...`,
      );
      const args = [
        "tasks-show",
        "--config",
        dca.config,
        "--mode",
        "downloads",
        "--output",
        downloadsFile,
        "--dir",
        tasksDir,
      ];
      void extLogger.log(
        `Running '${dca.bin}' ${args.map((a) => `'${a}'`).join(" ")}...`,
      );
      execFileSync(dca.bin, args);
    }
    return readJsonSync(downloadsFile) as MinimalDownloadsType;
  }

  /**
   * Fetches the tasks data for an experiment and returns the path to the directory they are store in.
   */
  private async getTasksForExperiment(experimentName: string) {
    const client = await this.app.credentials.getOctokit();

    // XXX implementation details:
    const dataBranch = `data/${experimentName}`;
    const tasksPath = `tasks/tasks.yml.gz`;

    // get the tasks.yml.gz file from the data branch
    // note that it might be large, so get the raw content explicitly after fetching the metadata
    const baseContentRequestArgs = {
      ...dcaControllerRepository,
      ref: dataBranch,
      path: tasksPath,
    };
    const tasksResponse = await client.repos.getContent(baseContentRequestArgs);
    if (
      !tasksResponse.data ||
      !("type" in tasksResponse.data) ||
      tasksResponse.data.type !== "file"
    ) {
      throw new Error(
        `No file found at ${dcaControllerRepository.owner}/${dcaControllerRepository.repo}/blob/${dataBranch}/${tasksPath}`,
      );
    }
    const tasksSha = tasksResponse.data.sha;
    const baseTasksDir = join(this.workingDirectory, "tasks");
    const tasksDir = join(baseTasksDir, tasksSha);
    if (existsSync(tasksDir) && readdirSync(tasksDir).length > 0) {
      void extLogger.log(`Skipping download to existing '${tasksDir}'...`);
    } else {
      void extLogger.log(
        `Downloading ${tasksResponse.data.size} bytes to ${tasksDir}...`,
      );
      // fetch and write the raw content directly to the tasksDir
      const raw = await client.request(
        "GET /repos/{owner}/{repo}/git/blobs/{sha}",
        {
          ...baseContentRequestArgs,
          sha: tasksSha,
          headers: {
            Accept: "application/vnd.github.v3.raw",
          },
        },
      );
      await ensureDir(tasksDir);
      writeFileSync(
        join(tasksDir, basename(tasksPath)),
        Buffer.from(raw.data as unknown as ArrayBuffer),
      );
    }
    return tasksDir;
  }

  private async resolveExperimentChoice(
    userValue: string | undefined,
  ): Promise<string | undefined> {
    if (!userValue) {
      return undefined;
    }
    const client = await this.app.credentials.getOctokit();
    // cases to handle:
    // - issue URL -> resolve to experiment name from issue title
    // - tree/blob URL -> resolve to experiment name by matching on the path
    // - otherwise -> assume it's an experiment name

    const issuePrefix = `${GITHUB_URL.toString()}${dcaControllerRepository.owner}/${dcaControllerRepository.repo}/issues/`;
    if (userValue.startsWith(issuePrefix)) {
      // parse the issue number
      const issueNumber = userValue
        .slice(issuePrefix.length)
        .match(/^\d+/)?.[0];
      if (!issueNumber) {
        throw new Error(
          `Invalid specific issue URL: ${userValue}, can not parse the issue number from it`,
        );
      }
      // resolve the issue number to the experiment name by fetching the issue title and assuming it has the right format
      const issue = await client.rest.issues.get({
        ...dcaControllerRepository,
        issue_number: parseInt(issueNumber),
      });
      const title = issue.data.title;
      const pattern = /^Experiment (.+)$/;
      const match = title.match(pattern);
      if (!match) {
        throw new Error(
          `Invalid issue title: ${title}, does not match the expected pattern ${pattern.toString()}`,
        );
      }
      void extLogger.log(
        `Resolved issue ${issueNumber} to experiment ${match[1]}`,
      );
      return match[1];
    }
    const blobPrefix = `${GITHUB_URL.toString()}${dcaControllerRepository.owner}/${dcaControllerRepository.repo}/blob/data/`;
    const treePrefix = `${GITHUB_URL.toString()}${dcaControllerRepository.owner}/${dcaControllerRepository.repo}/tree/data/`;
    let blobTreeSuffix;
    if (userValue.startsWith(blobPrefix)) {
      blobTreeSuffix = userValue.slice(blobPrefix.length);
    } else if (userValue.startsWith(treePrefix)) {
      blobTreeSuffix = userValue.slice(treePrefix.length);
    } else {
      void extLogger.log(`Assuming ${userValue} is an experiment name already`);
      return userValue;
    }
    // parse the blob/tree suffix: the experiment name is the path components before the last `reports`
    const reportsIndex = blobTreeSuffix.lastIndexOf("/reports");
    if (reportsIndex === -1) {
      throw new Error(
        `Invalid blob/tree URL: ${userValue}, can not find the /reports suffix in it`,
      );
    }
    void extLogger.log(
      `Resolved blob/tree URL ${userValue} to experiment ${blobTreeSuffix.slice(0, reportsIndex)}`,
    );
    return blobTreeSuffix.slice(0, reportsIndex);
  }

  private async pickTargets(progress?: ProgressCallback): Promise<
    | {
        before: ArtifactDownload;
        after: ArtifactDownload;
        description: ComparePerformanceDescriptionData;
      }
    | undefined
  > {
    progress?.({
      message: "Picking experiment",
      step: 1,
      maxStep: this.PICK_TARGETS_PROGRESS_STEPS,
    });

    const experimentChoice = await this.resolveExperimentChoice(
      await window.showInputBox({
        title: `Enter an experiment name or a github issue/blob/tree reports URL to the experiment`,
        placeHolder:
          "esbena/pr-17968-6d8ef2__nightly__nightly__1, https://github.com/github/codeql-dca-main/issues/24803, https://github.com/github/codeql-dca-main/tree/data/esbena/auto/esbena/tasks-show-downloads/53d1022/1731599740789/reports or https://github.com/github/codeql-dca-main/blob/data/esbena/auto/esbena/tasks-show-downloads/53d1022/1731599740789/reports/checkpoints.md",
        ignoreFocusOut: true,
      }),
    );

    if (!experimentChoice) {
      return undefined;
    }

    progress?.({
      message: `Downloading data from experiment ${experimentChoice}`,
      step: 2,
      maxStep: this.PICK_TARGETS_PROGRESS_STEPS,
    });
    const targetInfos = await this.getPotentialTargetInfos(experimentChoice);
    if (targetInfos.length === 0) {
      throw new Error(
        `No targets found in experiment ${experimentChoice}. Is the experiment complete enough yet?`,
      );
    }
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
    const targetInfoChoice2 = targetInfos.find(
      (t) => t.info.target_id === targetChoice2,
    )!;
    return {
      before: targetInfoChoice1.downloads["evaluator-logs"],
      after: targetInfoChoice2.downloads["evaluator-logs"],
      description: {
        kind: "remote-logs",
        experimentName: experimentChoice,
        fromTarget: targetInfoChoice1,
        toTarget: targetInfoChoice2,
      },
    };
  }
}
