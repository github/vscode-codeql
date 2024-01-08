import { pathExists } from "fs-extra";
import type { BqrsInfo } from "../common/bqrs-cli-types";
import type { QueryMetadata } from "../common/interface-types";
import {
  ALERTS_TABLE_NAME,
  getDefaultResultSetName,
} from "../common/interface-types";

export async function getResultSetNames(
  schemas: BqrsInfo,
  metadata: QueryMetadata | undefined,
  interpretedResultsPath: string | undefined,
): Promise<string[]> {
  const schemaNames = schemas["result-sets"].map((schema) => schema.name);

  if (metadata?.kind !== "graph" && interpretedResultsPath) {
    if (await pathExists(interpretedResultsPath)) {
      schemaNames.push(ALERTS_TABLE_NAME);
    }
  }

  return schemaNames;
}

export function findCommonResultSetNames(
  fromSchemaNames: string[],
  toSchemaNames: string[],
): string[] {
  return fromSchemaNames.filter((name) => toSchemaNames.includes(name));
}

export type CompareQueryInfo = {
  schemas: BqrsInfo;
  schemaNames: string[];
  metadata: QueryMetadata | undefined;
  interpretedResultsPath: string;
};

export async function findResultSetNames(
  from: CompareQueryInfo,
  to: CompareQueryInfo,
  commonResultSetNames: readonly string[],
  selectedResultSetName: string | undefined,
) {
  const fromSchemaNames = from.schemaNames;
  const toSchemaNames = to.schemaNames;

  // Fall back on the default result set names if there are no common ones.
  const defaultFromResultSetName = fromSchemaNames.find((name) =>
    name.startsWith("#"),
  );
  const defaultToResultSetName = toSchemaNames.find((name) =>
    name.startsWith("#"),
  );

  if (
    commonResultSetNames.length === 0 &&
    !(defaultFromResultSetName || defaultToResultSetName)
  ) {
    throw new Error(
      "No common result sets found between the two queries. Please check that the queries are compatible.",
    );
  }

  const currentResultSetName =
    selectedResultSetName ?? getDefaultResultSetName(commonResultSetNames);
  const fromResultSetName = currentResultSetName || defaultFromResultSetName!;
  const toResultSetName = currentResultSetName || defaultToResultSetName!;

  return {
    currentResultSetName,
    currentResultSetDisplayName:
      currentResultSetName ||
      `${defaultFromResultSetName} <-> ${defaultToResultSetName}`,
    fromResultSetName,
    toResultSetName,
  };
}
