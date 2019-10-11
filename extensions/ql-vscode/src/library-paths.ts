import * as child_process from "child_process"
import * as util from 'util'
import * as path from 'path'
import { QLConfiguration } from "./config";
import { logger } from "./logging";


/**
 * The expected output of codeql resolve library-path
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
export async function resolveLibraryPath(config: QLConfiguration, workspaces: string[], queryPath: string): Promise<QuerySetup> {
    const base = path.join(config.qlDistributionPath, "tools/odasa");

    const coreArgs = ["codeql", "resolve", "library-path", "--format", "json"]
    const subcommandArgs = ["--additional-packs"].concat(workspaces).concat("--query", queryPath)
    try {
        logger.log(`Resolving library paths ${base} ${subcommandArgs.join(" ")}...`);
        const result = await util.promisify(child_process.execFile)(base, coreArgs.concat(subcommandArgs));
        logger.log(`Resolving library paths ${base} ${subcommandArgs.join(" ")}...`);
        return JSON.parse(result.stdout) as QuerySetup
    } catch (err) {
        throw new Error(`Failed to resolve library path : ${err.stderr || err}`)
    }
}
