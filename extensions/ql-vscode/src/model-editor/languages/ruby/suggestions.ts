import type { BaseLogger } from "../../../common/logging";
import type {
  BqrsCellValue,
  BqrsEntityValue,
  DecodedBqrsChunk,
} from "../../../common/bqrs-cli-types";
import type { ModelsAsDataLanguage } from "../models-as-data";
import type { AccessPathSuggestionRow } from "../../suggestions";
import { isDefinitionType } from "../../suggestions";
import {
  parseRubyMethodFromPath,
  rubyEndpointType,
  rubyMethodSignature,
} from "./access-paths";

function checkTupleFormat(
  tuple: BqrsCellValue[],
): tuple is [string, string, string, BqrsEntityValue, string] {
  if (tuple.length !== 5) {
    return false;
  }

  const [type, methodName, value, node, definitionType] = tuple;
  if (
    typeof type !== "string" ||
    typeof methodName !== "string" ||
    typeof value !== "string" ||
    typeof node !== "object" ||
    typeof definitionType !== "string"
  ) {
    return false;
  }

  if (Array.isArray(node)) {
    return false;
  }

  return true;
}

export function parseAccessPathSuggestionsResults(
  bqrs: DecodedBqrsChunk,
  _modelsAsDataLanguage: ModelsAsDataLanguage,
  logger: BaseLogger,
): AccessPathSuggestionRow[] {
  return bqrs.tuples
    .map((tuple, index): AccessPathSuggestionRow | null => {
      if (!checkTupleFormat(tuple)) {
        void logger.log(
          `Skipping result ${index} because it has the wrong format`,
        );
        return null;
      }

      const type = tuple[0];
      const methodName = parseRubyMethodFromPath(tuple[1]);
      const value = tuple[2];
      const node = tuple[3];
      const definitionType = tuple[4];

      if (!isDefinitionType(definitionType)) {
        void logger.log(
          `Skipping result ${index} because it has an invalid definition type`,
        );
        return null;
      }

      return {
        method: {
          packageName: "",
          endpointType: rubyEndpointType(type, methodName),
          typeName: type,
          methodName,
          methodParameters: "",
          signature: rubyMethodSignature(type, methodName),
        },
        value,
        details: node.label ?? "",
        definitionType,
      };
    })
    .filter(
      (suggestion): suggestion is AccessPathSuggestionRow =>
        suggestion !== null,
    );
}
