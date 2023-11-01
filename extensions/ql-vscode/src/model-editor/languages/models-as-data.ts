import { MethodDefinition } from "../method";
import { ModeledMethod, ModeledMethodType } from "../modeled-method";
import { DataTuple } from "../model-extension-file";
import { Mode } from "../shared/mode";
import type { QueryConstraints } from "../../local-queries/query-constraints";
import { DecodedBqrs } from "../../common/bqrs-cli-types";
import { BaseLogger } from "../../common/logging";

type GenerateMethodDefinition = (method: ModeledMethod) => DataTuple[];
type ReadModeledMethod = (row: DataTuple[]) => ModeledMethod;

export type ModelsAsDataLanguageModelType = Exclude<ModeledMethodType, "none">;

export type ModelsAsDataLanguagePredicate = {
  extensiblePredicate: string;
  supportedKinds: string[];
  generateMethodDefinition: GenerateMethodDefinition;
  readModeledMethod: ReadModeledMethod;
};

type ModelsAsDataLanguageModelGeneration = {
  queryConstraints: QueryConstraints;
  filterQueries?: (queryPath: string) => boolean;
  parseResults: (
    // The path to the query that generated the results.
    queryPath: string,
    // The results of the query.
    bqrs: DecodedBqrs,
    // The language-specific predicate that was used to generate the results. This is passed to allow
    // sharing of code between different languages.
    modelsAsDataLanguage: ModelsAsDataLanguage,
    // The logger to use for logging.
    logger: BaseLogger,
  ) => ModeledMethod[];
};

export type ModelsAsDataLanguagePredicates = Record<
  ModelsAsDataLanguageModelType,
  ModelsAsDataLanguagePredicate
>;

export type ModelsAsDataLanguage = {
  /**
   * The modes that are available for this language. If not specified, all
   * modes are available.
   */
  availableModes?: Mode[];
  createMethodSignature: (method: MethodDefinition) => string;
  predicates: ModelsAsDataLanguagePredicates;
  modelGeneration?: ModelsAsDataLanguageModelGeneration;
};
