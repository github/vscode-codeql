import * as child_process from "child_process";
import * as fs from 'fs-extra';
import * as path from 'path';
import * as sarif from 'sarif';
import * as util from 'util';
import { Logger, ProgressReporter } from "./logging";
import { Disposable } from "vscode";
import { DistributionProvider } from "./distribution";
import { SortDirection } from "./interface-types";
import { assertNever } from "./helpers-pure";

/**
 * The version of the SARIF format that we are using.
 */
const SARIF_FORMAT = "sarifv2.1.0";

/**
 * Flags to pass to all cli commands.
 */
const LOGGING_FLAGS = ['-v', '--log-to-stderr'];

/**
 * The expected output of `codeql resolve library-path`.
 */
export interface QuerySetup {
  libraryPath: string[],
  dbscheme: string,
  relativeName?: string,
  compilationCache?: string
}

/**
 * The expected output of `codeql resolve database`.
 */
export interface DbInfo {
  sourceLocationPrefix: string;
  columnKind: string;
  unicodeNewlines: boolean;
  sourceArchiveZip: string;
  sourceArchiveRoot: string;
  datasetFolder: string;
  logsFolder: string;
}

/**
 * The expected output of `codeql resolve upgrades`.
 */
export interface UpgradesInfo {
  scripts: string[];
  finalDbscheme: string;
}

/**
 * The expected output of `codeql resolve metadata`.
 */
export interface QueryMetadata {
  name?: string,
  description?: string,
  id?: string,
  kind?: string
}

// `codeql bqrs interpret` requires both of these to be present or
// both absent.
export interface SourceInfo {
  sourceArchive: string;
  sourceLocationPrefix: string;
}

/**
 * This class manages a cli server started by `codeql execute cli-server` to
 * run commands without the overhead of starting a new java
 * virtual machine each time. This class also controls access to the server
 * by queueing the commands sent to it.
 */
export class CodeQLCliServer implements Disposable {

  /** The process for the cli server, or undefined if one doesn't exist yet */
  process?: child_process.ChildProcessWithoutNullStreams;
  /** Queue of future commands*/
  commandQueue: (() => void)[];
  /** Whether a command is running */
  commandInProcess: boolean;
  /**  A buffer with a single null byte. */
  nullBuffer: Buffer;

  constructor(private config: DistributionProvider, private logger: Logger) {
    this.commandQueue = [];
    this.commandInProcess = false;
    this.nullBuffer = Buffer.alloc(1);
    if (this.config.onDidChangeDistribution) {
      this.config.onDidChangeDistribution(() => {
        this.restartCliServer();
      });
    }
  }


  dispose() {
    this.killProcessIfRunning();
  }

  killProcessIfRunning() {
    if (this.process) {
      // Tell the Java CLI server process to shut down.
      this.logger.log('Sending shutdown request');
      try {
        this.process.stdin.write(JSON.stringify(["shutdown"]), "utf8");
        this.process.stdin.write(this.nullBuffer);
        this.logger.log('Sent shutdown request');
      } catch (e) {
        // We are probably fine here, the process has already closed stdin.
        this.logger.log(`Shutdown request failed: process stdin may have already closed. The error was ${e}`);
        this.logger.log('Stopping the process anyway.');
      }
      // Close the stdin and stdout streams.
      // This is important on Windows where the child process may not die cleanly.
      this.process.stdin.end();
      this.process.kill();
      this.process.stdout.destroy();
      this.process.stderr.destroy();
      this.process = undefined;

    }
  }

  /**
   * Restart the server when the current command terminates
   */
  private restartCliServer() {
    let callback = () => {
      try {
        this.killProcessIfRunning();
      } finally {
        this.runNext();
      }
    };

    // If the server is not running a command run this immediately
    // otherwise add to the front of the queue (as we want to run this after the next command()).
    if (this.commandInProcess) {
      this.commandQueue.unshift(callback)
    } else {
      callback();
    }

  }

  /**
   * Launch the cli server
   */
  private async launchProcess(): Promise<child_process.ChildProcessWithoutNullStreams> {
    const config = await this.config.getCodeQlPathWithoutVersionCheck();
    if (!config) {
      throw new Error("Failed to find codeql distribution")
    }
    return spawnServer(config, "CodeQL CLI Server", ["execute", "cli-server"], [], this.logger, data => { })
  }

  private async runCodeQlCliInternal(command: string[], commandArgs: string[], description: string): Promise<string> {
    let stderrBuffers: Buffer[] = [];
    if (this.commandInProcess) {
      throw new Error("runCodeQlCliInternal called while cli was running")
    }
    this.commandInProcess = true;
    try {
      //Launch the process if it doesn't exist
      if (!this.process) {
        this.process = await this.launchProcess()
      }
      // Grab the process so that typescript know that it is always defined.
      const process = this.process;
      // The array of fragments of stdout
      let stdoutBuffers: Buffer[] = [];

      // Compute the full args array
      const args = command.concat(LOGGING_FLAGS).concat(commandArgs);
      const argsString = args.join(" ");
      this.logger.log(`${description} using CodeQL CLI: ${argsString}...`);
      try {
        await new Promise((resolve, reject) => {
          // Start listening to stdout
          process.stdout.addListener('data', (newData: Buffer) => {
            stdoutBuffers.push(newData);
            // If the buffer ends in '0' then exit.
            // We don't have to check the middle as no output will be written after the null until
            // the next command starts
            if (newData.length > 0 && newData.readUInt8(newData.length - 1) === 0) {
              resolve();
            }
          });
          // Listen to stderr
          process.stderr.addListener('data', (newData: Buffer) => {
            stderrBuffers.push(newData);
          });
          // Listen for process exit.
          process.addListener("close", (code) => reject(code));
          // Write the command followed by a null terminator.
          process.stdin.write(JSON.stringify(args), "utf8")
          process.stdin.write(this.nullBuffer)
        });
        // Join all the data together
        let fullBuffer = Buffer.concat(stdoutBuffers);
        // Make sure we remove the terminator;
        let data = fullBuffer.toString("utf8", 0, fullBuffer.length - 1);
        this.logger.log(`CLI command succeeded.`);
        return data;
      } catch (err) {
        // Kill the process if it isn't already dead.
        this.killProcessIfRunning();
        // Report the error (if there is a stderr then use that otherwise just report the error cod or nodejs error)
        if (stderrBuffers.length == 0) {
          throw new Error(`${description} failed: ${err}`)
        } else {
          throw new Error(`${description} failed: ${Buffer.concat(stderrBuffers).toString("utf8")}`);
        }
      } finally {
        this.logger.log(Buffer.concat(stderrBuffers).toString("utf8"));
        // Remove the listeners we set up.
        process.stdout.removeAllListeners('data')
        process.stderr.removeAllListeners('data')
        process.removeAllListeners("close");
      }
    } finally {
      this.commandInProcess = false;
      // start running the next command immediately
      this.runNext();
    }
  }

  /**
   * Run the next command in the queue
   */
  private runNext() {
    const callback = this.commandQueue.shift();
    if (callback) {
      callback();
    }
  }

  /**
   * Runs a CodeQL CLI command on the server, returning the output as a string.
   * @param command The `codeql` command to be run, provided as an array of command/subcommand names.
   * @param commandArgs The arguments to pass to the `codeql` command.
   * @param description Description of the action being run, to be shown in log and error messages.
   * @param progressReporter Used to output progress messages, e.g. to the status bar.
   * @returns The contents of the command's stdout, if the command succeeded.
   */
  runCodeQlCliCommand(command: string[], commandArgs: string[], description: string, progressReporter?: ProgressReporter): Promise<string> {
    if (progressReporter) {
      progressReporter.report({ message: description });
    }

    return new Promise((resolve, reject) => {
      // Construct the command that actually does the work
      const callback = () => {
        try {
          this.runCodeQlCliInternal(command, commandArgs, description).then(resolve, reject);
        } catch (err) {
          reject(err);
        }
      }
      // If the server is not running a command, then run the given command immediately,
      // otherwise add to the queue
      if (this.commandInProcess) {
        this.commandQueue.push(callback)
      } else {
        callback();
      }
    });
  }

  /**
   * Runs a CodeQL CLI command, returning the output as JSON.
   * @param command The `codeql` command to be run, provided as an array of command/subcommand names.
   * @param commandArgs The arguments to pass to the `codeql` command.
   * @param description Description of the action being run, to be shown in log and error messages.
   * @param progressReporter Used to output progress messages, e.g. to the status bar.
   * @returns The contents of the command's stdout, if the command succeeded.
   */
  async runJsonCodeQlCliCommand<OutputType>(command: string[], commandArgs: string[], description: string, progressReporter?: ProgressReporter): Promise<OutputType> {
    // Add format argument first, in case commandArgs contains positional parameters.
    const args = ['--format', 'json'].concat(commandArgs);
    const result = await this.runCodeQlCliCommand(command, args, description, progressReporter);
    try {
      return JSON.parse(result) as OutputType;
    } catch (err) {
      throw new Error(`Parsing output of ${description} failed: ${err.stderr || err}`)
    }
  }

  /**
   * Resolve the library path and dbscheme for a query.
   * @param workspaces The current open workspaces
   * @param queryPath The path to the query
   */
  async resolveLibraryPath(workspaces: string[], queryPath: string): Promise<QuerySetup> {
    const subcommandArgs = [
      '--query', queryPath,
      "--additional-packs",
      workspaces.join(path.delimiter)
    ];
    return await this.runJsonCodeQlCliCommand<QuerySetup>(['resolve', 'library-path'], subcommandArgs, "Resolving library paths");
  }

  /**
   * Gets the metadata for a query.
   * @param queryPath The path to the query.
   */
  async resolveMetadata(queryPath: string): Promise<QueryMetadata> {
    return await this.runJsonCodeQlCliCommand<QueryMetadata>(['resolve', 'metadata'], [queryPath], "Resolving query metadata");
  }

  /**
   * Gets the RAM setting for the query server.
   * @param queryMemoryMb The maximum amount of RAM to use, in MB.
   * Leave `undefined` for CodeQL to choose a limit based on the available system memory.
   * @returns String arguments that can be passed to the CodeQL query server,
   * indicating how to split the given RAM limit between heap and off-heap memory.
   */
  async resolveRam(queryMemoryMb: number | undefined, progressReporter?: ProgressReporter): Promise<string[]> {
    const args: string[] = [];
    if (queryMemoryMb !== undefined) {
      args.push('--ram', queryMemoryMb.toString());
    }
    return await this.runJsonCodeQlCliCommand<string[]>(['resolve', 'ram'], args, "Resolving RAM settings", progressReporter);
  }


  async interpretBqrs(metadata: { kind: string, id: string }, resultsPath: string, interpretedResultsPath: string, sourceInfo?: SourceInfo): Promise<sarif.Log> {
    const args = [
      `-t=kind=${metadata.kind}`,
      `-t=id=${metadata.id}`,
      "--output", interpretedResultsPath,
      "--format", SARIF_FORMAT,
      // TODO: This flag means that we don't group interpreted results
      // by primary location. We may want to revisit whether we call
      // interpretation with and without this flag, or do some
      // grouping client-side.
      "--no-group-results",
    ];
    if (sourceInfo !== undefined) {
      args.push(
        "--source-archive", sourceInfo.sourceArchive,
        "--source-location-prefix", sourceInfo.sourceLocationPrefix
      );
    }
    args.push(resultsPath);
    await this.runCodeQlCliCommand(['bqrs', 'interpret'], args, "Interpreting query results");

    let output: string;
    try {
      output = await fs.readFile(interpretedResultsPath, 'utf8');
    } catch (err) {
      throw new Error(`Reading output of interpretation failed: ${err.stderr || err}`)
    }
    try {
      return JSON.parse(output) as sarif.Log;
    } catch (err) {
      throw new Error(`Parsing output of interpretation failed: ${err.stderr || err}`)
    }
  }


  async sortBqrs(resultsPath: string, sortedResultsPath: string, resultSet: string, sortKeys: number[], sortDirections: SortDirection[]): Promise<void> {
    const sortDirectionStrings = sortDirections.map(direction => {
      switch (direction) {
        case SortDirection.asc:
          return "asc";
        case SortDirection.desc:
          return "desc";
        default:
          return assertNever(direction);
      }
    });

    await this.runCodeQlCliCommand(['bqrs', 'decode'],
      [
        "--format=bqrs",
        `--result-set=${resultSet}`,
        `--output=${sortedResultsPath}`,
        `--sort-key=${sortKeys.join(",")}`,
        `--sort-direction=${sortDirectionStrings.join(",")}`,
        resultsPath
      ],
      "Sorting query results");
  }


  /**
   * Returns the `DbInfo` for a database.
   * @param databasePath Path to the CodeQL database to obtain information from.
   */
  resolveDatabase(databasePath: string): Promise<DbInfo> {
    return this.runJsonCodeQlCliCommand(['resolve', 'database'], [databasePath],
      "Resolving database");
  }


  /**
   * Gets information necessary for upgrading a database.
   * @param dbScheme the path to the dbscheme of the database to be upgraded.
   * @param searchPath A list of directories to search for upgrade scripts.
   * @returns A list of database upgrade script directories
   */
  resolveUpgrades(dbScheme: string, searchPath: string[]): Promise<UpgradesInfo> {
    const args = ['--additional-packs', searchPath.join(path.delimiter), '--dbscheme', dbScheme];

    return this.runJsonCodeQlCliCommand<UpgradesInfo>(
      ['resolve', 'upgrades'],
      args,
      "Resolving database upgrade scripts",
    );
  }
}

/**
 * Spawns a child server process using the CodeQL CLI
 * and attaches listeners to it.
 *
 * @param config The configuration containing the path to the CLI.
 * @param name Name of the server being started, to be shown in log and error messages.
 * @param command The `codeql` command to be run, provided as an array of command/subcommand names.
 * @param commandArgs The arguments to pass to the `codeql` command.
 * @param logger Logger to write startup messages.
 * @param stderrListener Listener for log messages from the server's stderr stream.
 * @param stdoutListener Optional listener for messages from the server's stdout stream.
 * @param progressReporter Used to output progress messages, e.g. to the status bar.
 * @returns The started child process.
 */
export function spawnServer(
  codeqlPath: string,
  name: string,
  command: string[],
  commandArgs: string[],
  logger: Logger,
  stderrListener: (data: any) => void,
  stdoutListener?: (data: any) => void,
  progressReporter?: ProgressReporter
): child_process.ChildProcessWithoutNullStreams {
  // Enable verbose logging.
  const args = command.concat(commandArgs).concat(LOGGING_FLAGS);

  // Start the server process.
  const base = codeqlPath;
  const argsString = args.join(" ");
  if (progressReporter !== undefined) {
    progressReporter.report({ message: `Starting ${name}` });
  }
  logger.log(`Starting ${name} using CodeQL CLI: ${base} ${argsString}`);
  const child = child_process.spawn(base, args);
  if (!child || !child.pid) {
    throw new Error(`Failed to start ${name} using command ${base} ${argsString}.`);
  }

  // Set up event listeners.
  child.on('close', (code) => logger.log(`Child process exited with code ${code}`));
  child.stderr!.on('data', stderrListener);
  if (stdoutListener !== undefined) {
    child.stdout!.on('data', stdoutListener);
  }

  if (progressReporter !== undefined) {
    progressReporter.report({ message: `Started ${name}` });
  }
  logger.log(`${name} started on PID: ${child.pid}`);
  return child;
}

/**
 * Runs a CodeQL CLI command without invoking the CLI server, returning the output as a string.
 * @param config The configuration containing the path to the CLI.
 * @param command The `codeql` command to be run, provided as an array of command/subcommand names.
 * @param commandArgs The arguments to pass to the `codeql` command.
 * @param description Description of the action being run, to be shown in log and error messages.
 * @param logger Logger to write command log messages, e.g. to an output channel.
 * @param progressReporter Used to output progress messages, e.g. to the status bar.
 * @returns The contents of the command's stdout, if the command succeeded.
 */
export async function runCodeQlCliCommand(codeQlPath: string, command: string[], commandArgs: string[], description: string, logger: Logger, progressReporter?: ProgressReporter): Promise<string> {
  // Add logging arguments first, in case commandArgs contains positional parameters.
  const args = command.concat(LOGGING_FLAGS).concat(commandArgs);
  const argsString = args.join(" ");
  try {
    if (progressReporter !== undefined) {
      progressReporter.report({ message: description });
    }
    logger.log(`${description} using CodeQL CLI: ${codeQlPath} ${argsString}...`);
    const result = await util.promisify(child_process.execFile)(codeQlPath, args);
    logger.log(result.stderr);
    logger.log(`CLI command succeeded.`);
    return result.stdout;
  } catch (err) {
    throw new Error(`${description} failed: ${err.stderr || err}`)
  }
}
