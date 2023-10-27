import { ModeledMethod, ModeledMethodType } from "../modeled-method";
import { DataTuple } from "../model-extension-file";

type GenerateMethodDefinition = (method: ModeledMethod) => DataTuple[];
type ReadModeledMethod = (row: DataTuple[]) => ModeledMethod;

export type ModelsAsDataLanguageModelType = Exclude<ModeledMethodType, "none">;

export type ModelsAsDataLanguageModel = {
  extensiblePredicate: string;
  supportedKinds: string[];
  generateMethodDefinition: GenerateMethodDefinition;
  readModeledMethod: ReadModeledMethod;
};

export type ModelsAsDataLanguage = Record<
  ModelsAsDataLanguageModelType,
  ModelsAsDataLanguageModel
>;
