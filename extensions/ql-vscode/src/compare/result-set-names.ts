import { BqrsInfo } from "../common/bqrs-cli-types";
import { getDefaultResultSetName } from "../common/interface-types";

export async function findCommonResultSetNames(
  fromSchemas: BqrsInfo,
  toSchemas: BqrsInfo,
): Promise<string[]> {
  const fromSchemaNames = fromSchemas["result-sets"].map(
    (schema) => schema.name,
  );
  const toSchemaNames = toSchemas["result-sets"].map((schema) => schema.name);

  return fromSchemaNames.filter((name) => toSchemaNames.includes(name));
}

export async function findResultSetNames(
  fromSchemas: BqrsInfo,
  toSchemas: BqrsInfo,
  commonResultSetNames: readonly string[],
  selectedResultSetName: string | undefined,
) {
  const fromSchemaNames = fromSchemas["result-sets"].map(
    (schema) => schema.name,
  );
  const toSchemaNames = toSchemas["result-sets"].map((schema) => schema.name);

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
    currentResultSetDisplayName:
      currentResultSetName ||
      `${defaultFromResultSetName} <-> ${defaultToResultSetName}`,
    fromResultSetName,
    toResultSetName,
  };
}
