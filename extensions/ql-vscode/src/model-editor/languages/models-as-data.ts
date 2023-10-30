import { MethodDefinition } from "../method";
import { ModeledMethod, ModeledMethodType } from "../modeled-method";
import { DataTuple } from "../model-extension-file";
import { Mode } from "../shared/mode";

type GenerateMethodDefinition = (method: ModeledMethod) => DataTuple[];
type ReadModeledMethod = (row: DataTuple[]) => ModeledMethod;

export type ModelsAsDataLanguageModelType = Exclude<ModeledMethodType, "none">;

export type ModelsAsDataLanguagePredicate = {
  extensiblePredicate: string;
  supportedKinds: string[];
  generateMethodDefinition: GenerateMethodDefinition;
  readModeledMethod: ReadModeledMethod;
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
};
