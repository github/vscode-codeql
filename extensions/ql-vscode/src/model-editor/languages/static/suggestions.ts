import type { BaseLogger } from "../../../common/logging";
import type { DecodedBqrsChunk } from "../../../common/bqrs-cli-types";
import type { ModelsAsDataLanguage } from "../models-as-data";
import type { AccessPathSuggestionRow } from "../../suggestions";
import { isDefinitionType } from "../../suggestions";

export function parseAccessPathSuggestionsResults(
  bqrs: DecodedBqrsChunk,
  _modelsAsDataLanguage: ModelsAsDataLanguage,
  logger: BaseLogger,
): AccessPathSuggestionRow[] {
  return bqrs.tuples
    .map((tuple, index): AccessPathSuggestionRow | null => {
      const row = tuple.filter(
        (value): value is string => typeof value === "string",
      );

      if (row.length !== 7) {
        void logger.log(
          `Skipping result ${index} because it has the wrong length`,
        );
        return null;
      }

      const packageName = row[0];
      const typeName = row[1];
      const methodName = row[2];
      const methodParameters = row[3];
      const value = row[4];
      const details = row[5];
      const definitionType = row[6];

      if (!isDefinitionType(definitionType)) {
        void logger.log(
          `Skipping result ${index} because it has an invalid definition type`,
        );
        return null;
      }

      return {
        method: {
          packageName,
          typeName,
          methodName,
          methodParameters,
          signature: `${packageName}.${typeName}#${methodName}${methodParameters}`,
        },
        value,
        details,
        definitionType,
      };
    })
    .filter(
      (suggestion): suggestion is AccessPathSuggestionRow =>
        suggestion !== null,
    );
}
