import { BQRSInfo } from "../common/bqrs-cli-types";

export async function findResultSetNames(
  fromSchemas: BQRSInfo,
  toSchemas: BQRSInfo,
  selectedResultSetName: string | undefined,
) {
  const fromSchemaNames = fromSchemas["result-sets"].map(
    (schema) => schema.name,
  );
  const toSchemaNames = toSchemas["result-sets"].map((schema) => schema.name);
  const commonResultSetNames = fromSchemaNames.filter((name) =>
    toSchemaNames.includes(name),
  );

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

  const currentResultSetName = selectedResultSetName || commonResultSetNames[0];
  const fromResultSetName = currentResultSetName || defaultFromResultSetName!;
  const toResultSetName = currentResultSetName || defaultToResultSetName!;

  return {
    commonResultSetNames,
    currentResultSetDisplayName:
      currentResultSetName ||
      `${defaultFromResultSetName} <-> ${defaultToResultSetName}`,
    fromResultSetName,
    toResultSetName,
  };
}
