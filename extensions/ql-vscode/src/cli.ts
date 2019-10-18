import * as child_process from "child_process";
import * as fs from 'fs-extra';
import * as path from 'path';
import * as sarif from 'sarif';
import * as util from 'util';
import { QueryServerConfig } from "./config";
import { Logger, ProgressReporter } from "./logging";

/**
 * The version of the SARIF format that we are using.
 */
const SARIF_FORMAT = "sarifv2.1.0";

/**
 * The expected output of codeql resolve library-path.
 */
export interface QuerySetup {
  libraryPath: string[],
  dbscheme: string,
  relativeName?: string,
  compilationCache?: string
}

/**
 * The expected output of codeql resolve database.
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
 * Resolve the library path and dbscheme for a query.
 * @param config The configuration
 * @param workspaces The current open workspaces
 * @param queryPath The path to the query
 */
export async function resolveLibraryPath(config: QueryServerConfig, workspaces: string[], queryPath: string, logger: Logger): Promise<QuerySetup> {
  const subcommandArgs = [
    '--query', queryPath,
    "--additional-packs",
    workspaces.join(path.delimiter)
  ];
  return await runJsonCodeQlCliCommand<QuerySetup>(config, ['resolve', 'library-path'], subcommandArgs, "Resolving library paths", logger);
}

/** The expected output of `codeql resolve metadata`. */
export interface QueryMetadata {
  name?: string,
  description?: string,
  id?: string,
  kind?: string
}

/**
 * Gets the metadata for a query.
 * @param config The configuration containing the path to the CLI.
 * @param queryPath The path to the query.
 */
export async function resolveMetadata(config: QueryServerConfig, queryPath: string, logger: Logger): Promise<QueryMetadata> {
  return await runJsonCodeQlCliCommand<QueryMetadata>(config, ['resolve', 'metadata'], [queryPath], "Resolving query metadata", logger);
}

/**
 * Gets the RAM setting for the query server.
 * @param config The configuration containing the path to the CLI.
 */
export async function resolveRam(config: QueryServerConfig, logger: Logger, progressReporter?: ProgressReporter): Promise<string[]> {
  return await runJsonCodeQlCliCommand<string[]>(config, ['resolve', 'ram'], [], "Resolving RAM settings", logger, progressReporter);
}

/**
 * Runs a CodeQL CLI command, returning the output as a string.
 * @param config The configuration containing the path to the CLI.
 * @param command The `codeql` command to be run, provided as an array of command/subcommand names.
 * @param commandArgs The arguments to pass to the `codeql` command.
 * @param description Description of the action being run, to be shown in log and error messages.
 * @param logger Logger to write command log messages, e.g. to an output channel.
 * @param progressReporter Used to output progress messages, e.g. to the status bar.

 * @returns The contents of the command's stdout, if the command succeeded.
 */
async function runCodeQlCliCommand(config: QueryServerConfig, command: string[], commandArgs: string[], description: string, logger: Logger, progressReporter?: ProgressReporter): Promise<string> {
  const base = config.codeQlPath;
  // Add logging arguments first, in case commandArgs contains positional parameters.
  const args = command.concat('-v', '--log=-').concat(commandArgs);
  const argsString = args.join(" ");
  try {
    if(progressReporter !== undefined) {
        progressReporter.report({message: description});
    }
    logger.log(`${description} using CodeQL CLI: ${base} ${argsString}...`);
    const result = await util.promisify(child_process.execFile)(base, args);
    logger.log(result.stderr);
    logger.log(`CLI command succeeded.`);
    return result.stdout;
  } catch (err) {
    throw new Error(`${description} failed: ${err.stderr || err}`)
  }
}

/**
 * Runs a CodeQL CLI command, returning the output as JSON.
 * @param config The configuration containing the path to the CLI.
 * @param command The `codeql` command to be run, provided as an array of command/subcommand names.
 * @param commandArgs The arguments to pass to the `codeql` command.
 * @param description Description of the action being run, to be shown in log and error messages.
 * @param logger Logger to write command log messages, e.g. to an output channel.
 * @param progressReporter Used to output progress messages, e.g. to the status bar.
 * @returns The contents of the command's stdout, if the command succeeded.
 */
async function runJsonCodeQlCliCommand<OutputType>(config: QueryServerConfig, command: string[], commandArgs: string[], description: string, logger: Logger, progressReporter?: ProgressReporter): Promise<OutputType> {
  // Add format argument first, in case commandArgs contains positional parameters.
  const args = ['--format', 'json'].concat(commandArgs);
  const result = await runCodeQlCliCommand(config, command, args, description, logger, progressReporter);
  try {
    return JSON.parse(result) as OutputType;
  } catch (err) {
    throw new Error(`Parsing output of ${description} failed: ${err.stderr || err}`)
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
export async function spawnServer(
  config: QueryServerConfig,
  name: string,
  command: string[],
  commandArgs: string[],
  logger: Logger,
  stderrListener: (data: any) => void,
  stdoutListener?: (data: any) => void,
  progressReporter?: ProgressReporter
): Promise<child_process.ChildProcessWithoutNullStreams> {
  // Enable verbose logging.
  const args = command.concat(commandArgs).concat('-v', '--log=-');

  // Start the server process.
  const base = config.codeQlPath;
  const argsString = args.join(" ");
  if(progressReporter !== undefined) {
    progressReporter.report({message: `Starting ${name}`});
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

  if(progressReporter !== undefined) {
    progressReporter.report({message: `Started ${name}`});
  }
  logger.log(`${name} started on PID: ${child.pid}`);
  return child;
}

/**
 * Returns the SARIF format interpretation of query results.
 * @param config The configuration containing the path to the CLI.
 * @param metadata Query metadata according to which we should interpret results.
 * @param resultsPath Path to the BQRS file to interpret.
 * @param interpretedResultsPath Path to the SARIF file to output.
 * @param logger Logger to write startup messages.
 */
export async function interpretBqrs(config: QueryServerConfig, metadata: { kind: string, id: string }, resultsPath: string, interpretedResultsPath: string, logger: Logger): Promise<sarif.Log> {
  await runCodeQlCliCommand(config, ['bqrs', 'interpret'],
    [
      `-t=kind=${metadata.kind}`,
      `-t=id=${metadata.id}`,
      "--output", interpretedResultsPath,
      "--format", SARIF_FORMAT,

      // TODO: This flag means that we don't group interpreted results
      // by primary location. We may want to revisit whether we call
      // interpretation with and without this flag, or do some
      // grouping client-side.
      "--no-group-results",

      resultsPath,
    ],
    "Interpreting query results", logger);

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

/**
 * Returns the `DbInfo` for a database.
 * @param config The configuration containing the path to the CLI.
 * @param databasePath Path to the CodeQL database to obtain information from.
 * @param logger Logger to write startup messages.
 */
export function resolveDatabase(config: QueryServerConfig, databasePath: string, logger: Logger): Promise<DbInfo> {
  return runJsonCodeQlCliCommand(config, ['resolve', 'database'], [databasePath],
    "Resolving database", logger);
}
