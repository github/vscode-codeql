import { pathExists, remove, readFile } from "fs-extra";
import { EOL } from "os";
import { join } from "path";
import type { Disposable, ExtensionContext } from "vscode";
import { extLogger } from "../common/logging/vscode";
import { readDirFullPaths } from "../common/files";
import type { QueryHistoryDirs } from "./query-history-dirs";
import type { QueryHistoryManager } from "./query-history-manager";
import { getErrorMessage } from "../common/helpers-pure";

const LAST_SCRUB_TIME_KEY = "lastScrubTime";

/**
 * Registers an interval timer that will periodically check for queries old enought
 * to be deleted.
 *
 * Note that this scrubber will clean all queries from all workspaces. It should not
 * run too often and it should only run from one workspace at a time.
 *
 * Generally, `wakeInterval` should be significantly shorter than `throttleTime`.
 *
 * @param wakeInterval How often to check to see if the job should run.
 * @param throttleTime How often to actually run the job.
 * @param maxQueryTime The maximum age of a query before is ready for deletion.
 * @param queryHistoryDirs The directories containing all query history information.
 * @param ctx The extension context.
 */
export function registerQueryHistoryScrubber(
  wakeInterval: number,
  throttleTime: number,
  maxQueryTime: number,
  queryHistoryDirs: QueryHistoryDirs,
  qhm: QueryHistoryManager,
  ctx: ExtensionContext,

  // optional callback to keep track of how many times the scrubber has run
  onScrubberRun?: () => void,
): Disposable {
  const deregister = setInterval(
    scrubQueries,
    wakeInterval,
    throttleTime,
    maxQueryTime,
    queryHistoryDirs,
    qhm,
    ctx,
    onScrubberRun,
  );

  return {
    dispose: () => {
      clearInterval(deregister);
    },
  };
}

async function scrubQueries(
  throttleTime: number,
  maxQueryTime: number,
  queryHistoryDirs: QueryHistoryDirs,
  qhm: QueryHistoryManager,
  ctx: ExtensionContext,
  onScrubberRun?: () => void,
) {
  const lastScrubTime = ctx.globalState.get<number>(LAST_SCRUB_TIME_KEY);
  const now = Date.now();

  // If we have never scrubbed before, or if the last scrub was more than `throttleTime` ago,
  // then scrub again.
  if (lastScrubTime === undefined || now - lastScrubTime >= throttleTime) {
    await ctx.globalState.update(LAST_SCRUB_TIME_KEY, now);

    let scrubCount = 0; // total number of directories deleted
    try {
      onScrubberRun?.();
      void extLogger.log(
        "Cleaning up query history directories. Removing old entries.",
      );

      if (!(await pathExists(queryHistoryDirs.localQueriesDirPath))) {
        void extLogger.log(
          `Cannot clean up query history directories. Local queries directory does not exist: ${queryHistoryDirs.localQueriesDirPath}`,
        );
        return;
      }
      if (!(await pathExists(queryHistoryDirs.variantAnalysesDirPath))) {
        void extLogger.log(
          `Cannot clean up query history directories. Variant analyses directory does not exist: ${queryHistoryDirs.variantAnalysesDirPath}`,
        );
        return;
      }

      const localQueryDirPaths = await readDirFullPaths(
        queryHistoryDirs.localQueriesDirPath,
      );
      const variantAnalysisDirPaths = await readDirFullPaths(
        queryHistoryDirs.variantAnalysesDirPath,
      );
      const allDirPaths = [...localQueryDirPaths, ...variantAnalysisDirPaths];

      const errors: string[] = [];
      for (const dir of allDirPaths) {
        const scrubResult = await scrubDirectory(dir, now, maxQueryTime);
        if (scrubResult.errorMsg) {
          errors.push(scrubResult.errorMsg);
        }
        if (scrubResult.deleted) {
          scrubCount++;
        }
      }

      if (errors.length) {
        throw new Error(EOL + errors.join(EOL));
      }
    } catch (e) {
      void extLogger.log(`Error while scrubbing queries: ${e}`);
    } finally {
      void extLogger.log(`Scrubbed ${scrubCount} old queries.`);
    }
    await qhm.removeDeletedQueries();
  }
}

async function scrubDirectory(
  dir: string,
  now: number,
  maxQueryTime: number,
): Promise<{
  errorMsg?: string;
  deleted: boolean;
}> {
  try {
    if (await shouldScrubDirectory(dir, now, maxQueryTime)) {
      await remove(dir);
      return { deleted: true };
    } else {
      return { deleted: false };
    }
  } catch (err) {
    return {
      errorMsg: `  Could not delete '${dir}': ${getErrorMessage(err)}`,
      deleted: false,
    };
  }
}

async function shouldScrubDirectory(
  dir: string,
  now: number,
  maxQueryTime: number,
): Promise<boolean> {
  const timestamp = await getTimestamp(join(dir, "timestamp"));
  if (timestamp === undefined || Number.isNaN(timestamp)) {
    void extLogger.log(`  ${dir} timestamp is missing or invalid. Deleting.`);
    return true;
  } else if (now - timestamp > maxQueryTime) {
    void extLogger.log(
      `  ${dir} is older than ${maxQueryTime / 1000} seconds. Deleting.`,
    );
    return true;
  } else {
    void extLogger.log(
      `  ${dir} is not older than ${maxQueryTime / 1000} seconds. Keeping.`,
    );
    return false;
  }
}

async function getTimestamp(
  timestampFile: string,
): Promise<number | undefined> {
  try {
    const timestampText = await readFile(timestampFile, "utf8");
    return parseInt(timestampText, 10);
  } catch (err) {
    void extLogger.log(
      `  Could not read timestamp file '${timestampFile}': ${getErrorMessage(
        err,
      )}`,
    );
    return undefined;
  }
}
