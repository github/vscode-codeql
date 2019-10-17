import * as child_process from "child_process"
import * as util from 'util'
import * as path from 'path'
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
    return await runCodeQlCliCommand<QuerySetup>(config, ['resolve', 'library-path'], subcommandArgs, "Resolving library paths", logger);
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
    return await runCodeQlCliCommand<QueryMetadata>(config, ['resolve', 'metadata'], [queryPath], "Resolving query metadata", logger);
}

/**
 * Gets the RAM setting for the query server.
 * @param config The configuration containing the path to the CLI.
 */
export async function resolveRam(config: QLConfiguration, logger: Logger): Promise<string[]> {
    return await runCodeQlCliCommand<string[]>(config, ['resolve', 'ram'], [], "Resolving RAM settings", logger);
}

/**
 * Runs a CodeQL CLI command, returning the output as JSON.
 * @param config The configuration containing the path to the CLI.
 * @param command The `codeql` command to be run, provided as an array of command/subcommand names.
 * @param commandArgs The arguments to pass to the `codeql` command.
 * @param description Description of the action being run, to be shown in log and error messages.
 * @returns The contents of the command's stdout, if the command succeeded.
 */
async function runCodeQlCliCommand<OutputType>(config: QLConfiguration, command: string[], commandArgs: string[], description: string, logger: Logger): Promise<OutputType> {
    const base = config.codeQlPath;
    const args = command.concat(commandArgs).concat('-v', '--log=-', '--format', 'json');
    const argsString = args.join(" ");
    try {
        logger.log(`${description} using CodeQL CLI: ${base} ${argsString}...`);
        const result = await util.promisify(child_process.execFile)(base, args);
        logger.log(result.stderr);
        logger.log(`CLI command succeeded.`);
        return JSON.parse(result.stdout) as OutputType;
    } catch (err) {
        throw new Error(`${description} failed: ${err.stderr || err}`)
    }
}
