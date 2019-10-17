import * as child_process from "child_process";
import * as path from 'path';
import * as util from 'util';
import { QLConfiguration } from "./config";
import { Logger } from "./logging";

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
 * Resolve the library path and dbscheme for a query.
 * @param config The configuration
 * @param workspaces The current open workspaces
 * @param queryPath The path to the query
 */
export async function resolveLibraryPath(config: QLConfiguration, workspaces: string[], queryPath: string, logger: Logger): Promise<QuerySetup> {
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
export async function resolveMetadata(config: QLConfiguration, queryPath: string, logger: Logger): Promise<QueryMetadata> {
  return await runJsonCodeQlCliCommand<QueryMetadata>(config, ['resolve', 'metadata'], [queryPath], "Resolving query metadata", logger);
}

/**
 * Gets the RAM setting for the query server.
 * @param config The configuration containing the path to the CLI.
 */
export async function resolveRam(config: QLConfiguration, logger: Logger): Promise<string[]> {
  return await runJsonCodeQlCliCommand<string[]>(config, ['resolve', 'ram'], [], "Resolving RAM settings", logger);
}

/**
 * Runs a CodeQL CLI command, returning the output as a string.
 * @param config The configuration containing the path to the CLI.
 * @param command The `codeql` command to be run, provided as an array of command/subcommand names.
 * @param commandArgs The arguments to pass to the `codeql` command.
 * @param description Description of the action being run, to be shown in log and error messages.
 * @returns The contents of the command's stdout, if the command succeeded.
 */
async function runCodeQlCliCommand(config: QLConfiguration, command: string[], commandArgs: string[], description: string, logger: Logger): Promise<string> {
  const base = config.codeQlPath;
  const args = command.concat(commandArgs).concat('-v', '--log=-');
  const argsString = args.join(" ");
  try {
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
 * @returns The contents of the command's stdout, if the command succeeded.
 */
async function runJsonCodeQlCliCommand<OutputType>(config: QLConfiguration, command: string[], commandArgs: string[], description: string, logger: Logger): Promise<OutputType> {
  const result = await runCodeQlCliCommand(config, command, commandArgs.concat(['--format', 'json']), description, logger);
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
 * @returns The started child process.
 */
export async function spawnServer(
  config: QLConfiguration,
  name: string,
  command: string[],
  commandArgs: string[],
  logger: Logger,
  stderrListener: (data: any) => void,
  stdoutListener?: (data: any) => void,

): Promise<child_process.ChildProcessWithoutNullStreams> {
  // Enable verbose logging.
  const args = command.concat(commandArgs).concat('-v', '--log=-');

  // Start the server process.
  const base = config.codeQlPath;
  const argsString = args.join(" ");
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

  logger.log(`${name} started on PID: ${child.pid}`);
  return child;
}

