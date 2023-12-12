import * as React from "react";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { Method } from "../../model-editor/method";
import { MultipleModeledMethodsPanel } from "./MultipleModeledMethodsPanel";
import { QueryLanguage } from "../../common/query-language";
import { ModelingStatus } from "../../model-editor/shared/modeling-status";

export type ModeledMethodsPanelProps = {
  language: QueryLanguage;
  method: Method;
  modeledMethods: ModeledMethod[];
  modelingStatus: ModelingStatus;
  isModelingInProgress: boolean;
  onChange: (methodSignature: string, modeledMethods: ModeledMethod[]) => void;
};

export const ModeledMethodsPanel = ({
  language,
  method,
  modeledMethods,
  modelingStatus,
  isModelingInProgress,
  onChange,
}: ModeledMethodsPanelProps) => {
  return (
    <MultipleModeledMethodsPanel
      language={language}
      method={method}
      modeledMethods={modeledMethods}
      modelingStatus={modelingStatus}
      isModelingInProgress={isModelingInProgress}
      onChange={onChange}
    />
  );
};
