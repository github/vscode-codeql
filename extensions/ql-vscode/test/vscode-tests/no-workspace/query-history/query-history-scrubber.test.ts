import { readdirSync, mkdirSync, writeFileSync } from "fs-extra";
import { join } from "path";
import type { Disposable, ExtensionContext } from "vscode";

import { extLogger } from "../../../../src/common/logging/vscode";
import { registerQueryHistoryScrubber } from "../../../../src/query-history/query-history-scrubber";
import type { QueryHistoryManager } from "../../../../src/query-history/query-history-manager";
import { dirSync } from "tmp-promise";
import {
  ONE_DAY_IN_MS,
  ONE_HOUR_IN_MS,
  THREE_HOURS_IN_MS,
  TWO_HOURS_IN_MS,
} from "../../../../src/common/time";
import { mockedObject } from "../../utils/mocking.helpers";
import type { DirResult } from "tmp";

const now = Date.now();
// We don't want our times to align exactly with the hour,
// so we can better mimic real life
const LESS_THAN_ONE_DAY = ONE_DAY_IN_MS - 1000;

describe("query history scrubber", () => {
  let deregister: Disposable | undefined;
  let tmpDir: DirResult;

  beforeEach(() => {
    tmpDir = dirSync({
      unsafeCleanup: true,
    });

    jest.spyOn(extLogger, "log").mockResolvedValue(undefined);

    jest.useFakeTimers({
      doNotFake: ["setTimeout"],
      now,
    });
  });

  afterEach(() => {
    if (deregister) {
      deregister.dispose();
      deregister = undefined;
    }
    tmpDir.removeCallback();
  });

  it("should not throw an error when the query directory does not exist", async () => {
    const mockCtx = createMockContext();
    const runCounter = registerScrubber("idontexist", mockCtx);

    jest.advanceTimersByTime(ONE_HOUR_IN_MS);
    await wait();
    // "Should not have called the scrubber"
    expect(runCounter).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(ONE_HOUR_IN_MS - 1);
    await wait();
    // "Should not have called the scrubber"
    expect(runCounter).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(1);
    await wait();
    // "Should have called the scrubber once"
    expect(runCounter).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(TWO_HOURS_IN_MS);
    await wait();
    // "Should have called the scrubber a second time"
    expect(runCounter).toHaveBeenCalledTimes(2);

    expect((mockCtx.globalState as any).lastScrubTime).toBe(
      now + TWO_HOURS_IN_MS * 2,
    );
  });

  it("should scrub directories", async () => {
    // create two query directories that are right around the cut off time
    const queryDir = createMockQueryDir(
      ONE_HOUR_IN_MS,
      TWO_HOURS_IN_MS,
      THREE_HOURS_IN_MS,
    );
    registerScrubber(queryDir, createMockContext());

    jest.advanceTimersByTime(TWO_HOURS_IN_MS);
    await wait();

    // should have deleted only the invalid locations
    expectDirectories(
      queryDir,
      toQueryDirName(ONE_HOUR_IN_MS),
      toQueryDirName(TWO_HOURS_IN_MS),
      toQueryDirName(THREE_HOURS_IN_MS),
    );

    jest.advanceTimersByTime(LESS_THAN_ONE_DAY);
    await wait();

    // nothing should have happened...yet
    expectDirectories(
      queryDir,
      toQueryDirName(ONE_HOUR_IN_MS),
      toQueryDirName(TWO_HOURS_IN_MS),
      toQueryDirName(THREE_HOURS_IN_MS),
    );

    jest.advanceTimersByTime(1000);
    await wait();

    // should have deleted the two older directories
    // even though they have different time stamps,
    // they both expire during the same scrubbing period
    expectDirectories(queryDir, toQueryDirName(THREE_HOURS_IN_MS));

    // Wait until the next scrub time and the final directory is deleted
    jest.advanceTimersByTime(TWO_HOURS_IN_MS);
    await wait();

    // should have deleted everything
    expectDirectories(queryDir);
  });

  function expectDirectories(queryDir: string, ...dirNames: string[]) {
    const files = readdirSync(queryDir);
    expect(files.sort()).toEqual(dirNames.sort());
  }

  function createMockQueryDir(...timestamps: number[]) {
    const dir = tmpDir.name;
    const queryDir = join(dir, "query");
    // create qyuery directory and fill it with some query directories
    mkdirSync(queryDir);

    // create an invalid file
    const invalidFile = join(queryDir, "invalid.txt");
    writeFileSync(invalidFile, "invalid");

    // create a directory without a timestamp file
    const noTimestampDir = join(queryDir, "noTimestampDir");
    mkdirSync(noTimestampDir);
    writeFileSync(join(noTimestampDir, "invalid.txt"), "invalid");

    // create a directory with a timestamp file, but is invalid
    const invalidTimestampDir = join(queryDir, "invalidTimestampDir");
    mkdirSync(invalidTimestampDir);
    writeFileSync(join(invalidTimestampDir, "timestamp"), "invalid");

    // create a directories with a valid timestamp files from the args
    timestamps.forEach((timestamp) => {
      const dir = join(queryDir, toQueryDirName(timestamp));
      mkdirSync(dir);
      writeFileSync(join(dir, "timestamp"), `${now + timestamp}`);
    });

    return queryDir;
  }

  function toQueryDirName(timestamp: number) {
    return `query-${timestamp}`;
  }

  function createMockContext(): ExtensionContext {
    return {
      globalState: {
        lastScrubTime: now,
        get(key: string) {
          if (key !== "lastScrubTime") {
            throw new Error(`Unexpected key: ${key}`);
          }
          return this.lastScrubTime;
        },
        async update(key: string, value: any) {
          if (key !== "lastScrubTime") {
            throw new Error(`Unexpected key: ${key}`);
          }
          this.lastScrubTime = value;
        },
      },
    } as any as ExtensionContext;
  }

  function registerScrubber(dir: string, ctx: ExtensionContext): jest.Mock {
    const onScrubberRun = jest.fn();
    deregister = registerQueryHistoryScrubber(
      ONE_HOUR_IN_MS,
      TWO_HOURS_IN_MS,
      LESS_THAN_ONE_DAY,
      { localQueriesDirPath: dir, variantAnalysesDirPath: dir },
      mockedObject<QueryHistoryManager>({
        removeDeletedQueries: () => {
          return Promise.resolve();
        },
      }),
      ctx,
      onScrubberRun,
    );
    return onScrubberRun;
  }

  async function wait(ms = 500) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
});
