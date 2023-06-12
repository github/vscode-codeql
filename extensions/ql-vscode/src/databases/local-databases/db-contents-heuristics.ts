import { pathExists } from "fs-extra";
import { basename, join } from "path";
import { glob } from "glob";

/**
 * The following functions al heuristically determine metadata about databases.
 */

/**
 * Heuristically determines if the directory passed in corresponds
 * to a database root. A database root is a directory that contains
 * a codeql-database.yml or (historically) a .dbinfo file. It also
 * contains a folder starting with `db-`.
 */
export async function isLikelyDatabaseRoot(maybeRoot: string) {
  const [a, b, c] = await Promise.all([
    // databases can have either .dbinfo or codeql-database.yml.
    pathExists(join(maybeRoot, ".dbinfo")),
    pathExists(join(maybeRoot, "codeql-database.yml")),

    // they *must* have a db-{language} folder
    glob("db-*/", { cwd: maybeRoot }),
  ]);

  return (a || b) && c.length > 0;
}

/**
 * A language folder is any folder starting with `db-` that is itself not a database root.
 */
export async function isLikelyDbLanguageFolder(dbPath: string) {
  return (
    basename(dbPath).startsWith("db-") && !(await isLikelyDatabaseRoot(dbPath))
  );
}
