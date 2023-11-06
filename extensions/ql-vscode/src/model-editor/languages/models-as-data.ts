import { MethodArgument, MethodDefinition } from "../method";
import {
  ModeledMethod,
  NeutralModeledMethod,
  SinkModeledMethod,
  SourceModeledMethod,
  SummaryModeledMethod,
} from "../modeled-method";
import { DataTuple } from "../model-extension-file";
import { Mode } from "../shared/mode";
import type { QueryConstraints } from "../../local-queries/query-constraints";
import { DecodedBqrs } from "../../common/bqrs-cli-types";
import { BaseLogger } from "../../common/logging";

type GenerateMethodDefinition<T> = (method: T) => DataTuple[];
type ReadModeledMethod = (row: DataTuple[]) => ModeledMethod;

export type ModelsAsDataLanguagePredicate<T> = {
  extensiblePredicate: string;
  supportedKinds: string[];
  generateMethodDefinition: GenerateMethodDefinition<T>;
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

export type ModelsAsDataLanguagePredicates = {
  source?: ModelsAsDataLanguagePredicate<SourceModeledMethod>;
  sink?: ModelsAsDataLanguagePredicate<SinkModeledMethod>;
  summary?: ModelsAsDataLanguagePredicate<SummaryModeledMethod>;
  neutral?: ModelsAsDataLanguagePredicate<NeutralModeledMethod>;
};

export type MethodArgumentOptions = {
  options: MethodArgument[];
  defaultArgumentPath: string;
};

export type ModelsAsDataLanguage = {
  /**
   * The modes that are available for this language. If not specified, all
   * modes are available.
   */
  availableModes?: Mode[];
  createMethodSignature: (method: MethodDefinition) => string;
  predicates: ModelsAsDataLanguagePredicates;
  modelGeneration?: ModelsAsDataLanguageModelGeneration;
  /**
   * Returns the list of valid arguments that can be selected for the given method.
   * @param method The method to get the valid arguments for.
   */
  getArgumentOptions: (method: MethodDefinition) => MethodArgumentOptions;
};
