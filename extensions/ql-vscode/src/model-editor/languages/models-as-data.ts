import { MethodDefinition } from "../method";
import {
  ModeledMethod,
  NeutralModeledMethod,
  SinkModeledMethod,
  SourceModeledMethod,
  SummaryModeledMethod,
} from "../modeled-method";
import { DataTuple } from "../model-extension-file";

type GenerateMethodDefinition<T> = (method: T) => DataTuple[];
type ReadModeledMethod = (row: DataTuple[]) => ModeledMethod;

export type ModelsAsDataLanguagePredicate<T> = {
  extensiblePredicate: string;
  supportedKinds: string[];
  generateMethodDefinition: GenerateMethodDefinition<T>;
  readModeledMethod: ReadModeledMethod;
};

export type ModelsAsDataLanguagePredicates = {
  source?: ModelsAsDataLanguagePredicate<SourceModeledMethod>;
  sink?: ModelsAsDataLanguagePredicate<SinkModeledMethod>;
  summary?: ModelsAsDataLanguagePredicate<SummaryModeledMethod>;
  neutral?: ModelsAsDataLanguagePredicate<NeutralModeledMethod>;
};

export type ModelsAsDataLanguage = {
  createMethodSignature: (method: MethodDefinition) => string;
  predicates: ModelsAsDataLanguagePredicates;
};
