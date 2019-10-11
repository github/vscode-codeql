import * as child_process from "child_process"
import * as util from 'util'
import * as path from 'path'
import { QLConfiguration } from "./config";

export interface QuerySetup {
    "library-path": string[],
    dbscheme: string,
    "relative-name"?: string,
    "compilation-cache"?: string
}

/**
 * Resolve the library path and dbscheme for a query.
 * @param config The configuration
 * @param workspaces The current open workspaces
 * @param queryPath The path to the query
 */
export async function resolveLibraryPath(config :QLConfiguration, workspaces : string[], queryPath: string): Promise<QuerySetup> {
    const base = path.join(config.qlDistributionPath, "tools/odasa");

    const coreArgs = ["codeql", "resolve", "library-path", "--format", "json"]
    const subcommandArgs = ["--additional-packs"].concat(workspaces).concat("--query", queryPath)

    const result = await util.promisify(child_process.execFile)(base, coreArgs.concat(subcommandArgs));

    return JSON.parse(result.stdout) as QuerySetup
}
