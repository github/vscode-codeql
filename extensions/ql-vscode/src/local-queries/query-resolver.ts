import { CodeQLCliServer } from "../codeql-cli/cli";
import { DatabaseItem } from "../databases/local-databases";
import {
  getPrimaryDbscheme,
  getQlPackForDbscheme,
  QlPacksForLanguage,
} from "../databases/qlpack";
import { file } from "tmp-promise";
import { writeFile } from "fs-extra";
import { dump } from "js-yaml";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { redactableError } from "../common/errors";
import { showAndLogExceptionWithTelemetry } from "../common/logging";
import { extLogger } from "../common/logging/vscode";
import { telemetryListener } from "../common/vscode/telemetry";

export async function qlpackOfDatabase(
  cli: Pick<CodeQLCliServer, "resolveQlpacks">,
  db: Pick<DatabaseItem, "contents">,
): Promise<QlPacksForLanguage> {
  if (db.contents === undefined) {
    throw new Error("Database is invalid and cannot infer QLPack.");
  }
  const datasetPath = db.contents.datasetUri.fsPath;
  const dbscheme = await getPrimaryDbscheme(datasetPath);
  return await getQlPackForDbscheme(cli, dbscheme);
}

export interface QueryConstraints {
  kind?: string;
  "tags contain"?: string[];
  "tags contain all"?: string[];
}

/**
 * Finds the queries with the specified kind and tags in a list of CodeQL packs.
 *
 * @param cli The CLI instance to use.
 * @param qlpacks The list of packs to search.
 * @param constraints Constraints on the queries to search for.
 * @returns The found queries from the first pack in which any matching queries were found.
 */
async function resolveQueriesFromPacks(
  cli: CodeQLCliServer,
  qlpacks: string[],
  constraints: QueryConstraints,
): Promise<string[]> {
  const suiteFile = (
    await file({
      postfix: ".qls",
    })
  ).path;
  const suiteYaml = [];
  for (const qlpack of qlpacks) {
    suiteYaml.push({
      from: qlpack,
      queries: ".",
      include: constraints,
    });
  }
  await writeFile(
    suiteFile,
    dump(suiteYaml, {
      noRefs: true, // CodeQL doesn't really support refs
    }),
    "utf8",
  );

  return await cli.resolveQueriesInSuite(
    suiteFile,
    getOnDiskWorkspaceFolders(),
  );
}

/**
 * Finds the queries with the specified kind and tags in a QLPack.
 *
 * @param cli The CLI instance to use.
 * @param qlpacks The list of packs to search.
 * @param name The name of the query to use in error messages.
 * @param constraints Constraints on the queries to search for.
 * @returns The found queries from the first pack in which any matching queries were found.
 */
export async function resolveQueries(
  cli: CodeQLCliServer,
  qlpacks: QlPacksForLanguage,
  name: string,
  constraints: QueryConstraints,
): Promise<string[]> {
  const packsToSearch: string[] = [];

  // The CLI can handle both library packs and query packs, so search both packs in order.
  packsToSearch.push(qlpacks.dbschemePack);
  if (qlpacks.queryPack !== undefined) {
    packsToSearch.push(qlpacks.queryPack);
  }

  const queries = await resolveQueriesFromPacks(
    cli,
    packsToSearch,
    constraints,
  );
  if (queries.length > 0) {
    return queries;
  }

  // No queries found. Determine the correct error message for the various scenarios.
  const humanConstraints = [];
  if (constraints.kind !== undefined) {
    humanConstraints.push(`kind "${constraints.kind}"`);
  }
  if (constraints["tags contain"] !== undefined) {
    humanConstraints.push(`tagged "${constraints["tags contain"].join(" ")}"`);
  }
  if (constraints["tags contain all"] !== undefined) {
    humanConstraints.push(
      `tagged all of "${constraints["tags contain all"].join(" ")}"`,
    );
  }

  const joinedPacksToSearch = packsToSearch.join(", ");
  const error = redactableError`No ${name} queries (${humanConstraints.join(
    ", ",
  )}) could be found in the \
current library path (tried searching the following packs: ${joinedPacksToSearch}). \
Try upgrading the CodeQL libraries. If that doesn't work, then ${name} queries are not yet available \
for this language.`;

  void showAndLogExceptionWithTelemetry(extLogger, telemetryListener, error);
  throw error;
}
