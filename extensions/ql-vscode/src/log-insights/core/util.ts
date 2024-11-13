/**
 * Miscellaneous utility functions.
 *
 * TODO: split this file up into smaller files.
 */

import { execFileSync, spawn } from "child_process";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "fs-extra";
import { type } from "os";
import path from "path";
import { parser } from "stream-json/jsonl/Parser";
import { inspect } from "util";
import type {
  ComputeRecursive,
  InLayer,
  PipelineEvent,
  PipelineRun,
  Timing,
} from "./types";

/**
 * Creates a timestamped logging line for the given message.
 */
function makeLogLine(msg: string) {
  return `[${new Date().toISOString()}] <log-insights> ${msg}`;
}

/**
 * Converts the given executable name to the name of the executable on the current platform.
 *
 * I.e. `codeql` becomes `codeql.exe` on Windows.
 */
function maybeExe(codeql: string): string {
  return type() === "Windows_NT" ? `${codeql}.exe` : codeql;
}

export async function streamJsonl<T>(
  file: string,
  logEveryNth: number,
  handler: (t: T) => void,
): Promise<void> {
  let lineCount = 0;
  const stream = createReadStream(file)
    .pipe(parser())
    .on("data", (entry) => {
      lineCount++;
      if (lineCount % logEveryNth === 0) {
        log(`Processing line #${lineCount} of ${file}...`);
      }
      handler(entry);
    });

  return new Promise(function (resolve, reject) {
    stream.on("end", resolve);
    stream.on("error", reject);
  });
}

export function log(msg: string) {
  // TODO make the logger configurable
  console.log(makeLogLine(msg));
}

export function warn(msg: string) {
  // TODO make the logger configurable
  console.warn(makeLogLine(msg));
}

export function getMillis(event: PipelineEvent): Timing {
  switch (event.evaluationStrategy) {
    case "COMPUTE_SIMPLE":
    case "COMPUTE_RECURSIVE":
      return { millis: event.millis || 0 };
    case "IN_LAYER": {
      const [sum, index, maxSoFar] = event.predicateIterationMillis.reduce(
        ([sum, maxIndex, maxSoFar], milli, index) => {
          if (milli === -1) {
            return [sum, maxIndex, maxSoFar];
          }
          if (milli > maxSoFar) {
            // We add 1 to make the iteration index start at 1.
            return [sum + milli, index + 1, milli];
          } else {
            return [sum + milli, maxIndex, maxSoFar];
          }
        },
        // initial [sum, index, maxSoFar]
        [0, 1, -1],
      );
      return { millis: sum, maxIterationMillis: [index, maxSoFar] };
    }
    default:
      return { millis: 0 };
  }
}

/**
 * Logs the size of the given file in MB
 */
export function showFileSizeMB(file: string): void {
  if (!existsSync(file)) {
    warn(`File ${file} does not exist: cannot show size`);
    return;
  }
  log(`${file} is ${(statSync(file).size / 1024 / 1024).toFixed(2)} MB`);
}

type EventWithHash = InLayer | ComputeRecursive;

export function addEvent(
  m: Map<string, EventWithHash[]>,
  event: EventWithHash,
): void {
  const hash = getMainHash(event);
  if (!m.has(hash)) {
    m.set(hash, []);
  }

  m.get(hash)!.push(event);
}

function getMainHash(event: InLayer | ComputeRecursive): string {
  switch (event.evaluationStrategy) {
    case "IN_LAYER":
      return event.mainHash;
    case "COMPUTE_RECURSIVE":
      return event.raHash;
  }
}

// Iterate through an SCC with main node `event`.
export function iterateSCC(
  layerEvents: Map<string, Array<ComputeRecursive | InLayer>>,
  event: ComputeRecursive,
  func: (
    inLayerEvent: ComputeRecursive | InLayer,
    run: PipelineRun,
    iteration: number,
  ) => void,
) {
  const sccEvents = layerEvents.get(event.raHash);
  if (sccEvents === undefined) {
    throw new Error(`Could not find entry in layerEvents for ${event.raHash}`);
  }
  const nextPipeline: number[] = new Array(sccEvents.length).fill(0);

  const maxIteration = Math.max(
    ...sccEvents.map((e) => e.predicateIterationMillis.length),
  );

  for (let iteration = 0; iteration < maxIteration; ++iteration) {
    // Loop through each predicate in this iteration
    for (let predicate = 0; predicate < sccEvents.length; ++predicate) {
      const inLayerEvent = sccEvents[predicate];
      const iterationTime =
        inLayerEvent.predicateIterationMillis.length <= iteration
          ? -1
          : inLayerEvent.predicateIterationMillis[iteration];
      if (iterationTime !== -1) {
        const run: PipelineRun =
          inLayerEvent.pipelineRuns[nextPipeline[predicate]++];
        func(inLayerEvent, run, iteration);
      }
    }
  }
}

// Compute a key for the maps that that is sent to report generation.
// Should only be used on events that are known to define queryCausingWork.
export function makeKey(
  codeqlPath: string,
  queryCausingWork: string | undefined,
  predicate: string,
  hash: string,
  suffix = "",
): string {
  if (queryCausingWork === undefined) {
    throw new Error(
      "queryCausingWork was not defined on an event we expected it to be defined for!",
    );
  }
  return `${getQueryId(codeqlPath, queryCausingWork)}:${predicate}#${hash}#${
    suffix ? ` ${suffix}` : ""
  }`;
}

/**
 * Executes the given command line, forwarding stdout/stderr to the console.
 */
function execFollow(bin: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      console.log(
        makeCommandlineExecutionLogLine(
          bin,
          args,
          `Following output${cwd ? `. Executing in ${cwd}` : ""}`,
        ),
      );
      const p = spawn(maybeExe(bin), args, { stdio: [0, 1, 2], cwd });
      p.on("error", reject);
      p.on("exit", (code) => (code === 0 ? resolve() : reject(code)));
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Creates a pretty-printed version of the given command line, with everything single-quoted for easy copy-pasting.
 * (does not attempt to undo any quoting that was already present in the input arguments)
 */
function prettyPrintCommandline(command: string, args: string[]): string {
  return `\`${[command, ...args].map((v) => `'${v}'`).join(" ")}\``;
}

/**
 * Creates a timestamped logging line for the given command line.
 */
function makeCommandlineExecutionLogLine(
  command: string,
  args: string[],
  extraText?: string,
): string {
  if (args.some((a) => a === undefined || a === "")) {
    throw new Error(
      `Invalid empty or undefined arguments for ${command}: [${args.join(",")}]`,
    );
  }
  return `Running ${prettyPrintCommandline(command, args)}${
    extraText ? ` (${extraText})` : ""
  }`;
}

export function codeqlFollow(codeql: string, args: string[]): Promise<void> {
  return execFollow(codeql, args);
}

function codeqlJson<T>(codeql: string, args: string[]): T {
  return JSON.parse(_codeql(codeql, args).toString());
}

/**
 * Run the given codeql command with the given arguments.
 * Logs the command line that is being executed.
 * Returns the stdout of the command.
 */
function _codeql(codeql: string, args: string[]): Buffer {
  log(makeCommandlineExecutionLogLine(codeql, args));
  return execFileSync(maybeExe(codeql), args);
}

/**
 * Streams the output of the `bin` command with `args` to `outfile` (useful in the absence of an `--output-file` option).
 */
export function execToFile(
  bin: string,
  args: string[],
  outfile: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(
      makeCommandlineExecutionLogLine(
        bin,
        args,
        `Piping the output to ${outfile}`,
      ),
    );
    const p = spawn(maybeExe(bin), args, { stdio: "pipe" });
    p.stdout.pipe(createWriteStream(outfile));
    p.stderr.pipe(process.stderr);
    p.on("error", (e) => {
      console.error(
        `Process error for ${prettyPrintCommandline(
          bin,
          args,
        )}, ERROR: ${inspect(
          e,
        )}. See stderr above for more information. Showing stdout below:`,
      );
      attemptPrintFileContents(outfile);
      reject(e);
    });
    p.on("exit", (code) => {
      if (code === 0) {
        // silent success
        resolve();
      } else {
        console.error(
          `Non-zero process exit code for ${prettyPrintCommandline(
            bin,
            args,
          )}, CODE: ${code}. See stderr above for more information. Showing stdout below:`,
        );
        attemptPrintFileContents(outfile);
        reject(code);
      }
    });
  });
}

/**
 * Prints the content of the given file to stdout - special casing on the empty and non-existing file
 */
function attemptPrintFileContents(file: string) {
  let content;
  if (existsSync(file)) {
    content = readFileSync(file, "utf8");
    if (!content) {
      content = "<<empty file>>";
    }
  } else {
    content = "<<file does not exist>>";
  }
  console.log(content);
}

const queryIdCache: Map<string /* file */, string /* id */> = new Map();

/**
 * Gets the query id of the query at the given location
 */
export function getQueryId(codeqlPath: string, queryPath: string): string {
  const inCache = queryIdCache.has(queryPath);
  if (inCache) {
    return queryIdCache.get(queryPath)!;
  }
  let queryId: string;
  if (!existsSync(queryPath)) {
    warn(
      `Query file ${queryPath} does not exist. Using query file basename instead.`,
    );
    queryId = path.basename(queryPath);
  } else {
    queryId = codeqlJson<{ id: string }>(codeqlPath, [
      "resolve",
      "metadata",
      queryPath,
    ]).id;
  }
  queryIdCache.set(queryPath, queryId);
  return queryId;
}

export const LOG_EVERY_NTH_EVALUATOR_LOG_JSONL_LINE = 10000;

/**
 * Describes the given path in a human-readable way.
 */
export function describePath(p: string): string {
  const absolute = path.resolve(p);
  const size = totalDiskSize(p);
  const files = countFiles(p);
  return `${absolute} (${files} files, ${size} bytes)`;
}

/**
 * Recursively counts the files in a directory or file - not counting directories themselves.
 */
function countFiles(p: string): number {
  const seen = new Set<string>();
  function inner(p: string): number {
    if (seen.has(p)) {
      return 0;
    }
    seen.add(p);
    if (!existsSync(p)) {
      throw new Error(`File ${p} does not exist`);
    }
    if (statSync(p).isFile()) {
      return 1;
    }
    return readdirSync(p).reduce(
      (count, entry) => count + inner(path.join(p, entry)),
      0,
    );
  }
  return inner(p);
}

/**
 * Gets the total size of the given directory or file in bytes.
 */
function totalDiskSize(p: string): number {
  const seen = new Set<string>();
  function inner(p: string): number {
    if (seen.has(p)) {
      return 0;
    }
    seen.add(p);
    if (!existsSync(p)) {
      throw new Error(`File ${p} does not exist`);
    }
    const ownSize = statSync(p).size;
    if (statSync(p).isFile()) {
      return ownSize;
    }
    return readdirSync(p).reduce(
      (size, entry) => size + inner(path.join(p, entry)),
      ownSize,
    );
  }
  return inner(p);
}

/**
 * Writes the given object to the given file as JSON
 */
export function writeJson(file: string, obj: object): void {
  const str = JSON.stringify(obj, undefined, "  ");
  const DEBUG = false;
  if (DEBUG) {
    console.log(
      `Writing ${str.length} characters to ${file}: ${(str.length > 100
        ? `${str.slice(0, 40)} ... ${str.slice(str.length - 40)}`
        : str
      ).replace(/\n/g, "\\n")}`,
    );
  }
  writeFileSync(file, str, "utf8");
}
