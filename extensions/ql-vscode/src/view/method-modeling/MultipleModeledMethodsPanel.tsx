import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Method } from "../../model-editor/method";
import { ModeledMethod } from "../../model-editor/modeled-method";
import {
  canAddNewModeledMethod,
  canRemoveModeledMethod,
} from "../../model-editor/shared/multiple-modeled-methods";
import { styled } from "styled-components";
import { MethodModelingInputs } from "./MethodModelingInputs";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { Codicon } from "../common";
import { validateModeledMethods } from "../../model-editor/shared/validation";
import { ModeledMethodAlert } from "./ModeledMethodAlert";
import { QueryLanguage } from "../../common/query-language";

export type MultipleModeledMethodsPanelProps = {
  language: QueryLanguage;
  method: Method;
  modeledMethods: ModeledMethod[];
  isModelingInProgress: boolean;
  onChange: (methodSignature: string, modeledMethods: ModeledMethod[]) => void;
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  padding-bottom: 0.5rem;
  border-top: 0.05rem solid var(--vscode-panelSection-border);
  border-bottom: 0.05rem solid var(--vscode-panelSection-border);
`;

const AlertContainer = styled.div`
  margin-top: 0.5rem;
`;

const Footer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const PaginationActions = styled.div`
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
`;

const ModificationActions = styled.div`
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
`;

export const MultipleModeledMethodsPanel = ({
  language,
  method,
  modeledMethods,
  isModelingInProgress,
  onChange,
}: MultipleModeledMethodsPanelProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const selectNewMethod = useRef<number | null>(null);

  useEffect(() => {
    if (selectNewMethod.current === modeledMethods.length - 1) {
      setSelectedIndex(selectNewMethod.current);
      selectNewMethod.current = null;
      return;
    }

    if (selectedIndex >= modeledMethods.length) {
      setSelectedIndex(
        modeledMethods.length > 0 ? modeledMethods.length - 1 : 0,
      );
    }
  }, [modeledMethods.length, selectedIndex]);

  const handlePreviousClick = useCallback(() => {
    setSelectedIndex((previousIndex) => previousIndex - 1);
  }, []);
  const handleNextClick = useCallback(() => {
    setSelectedIndex((previousIndex) => previousIndex + 1);
  }, []);

  const validationErrors = useMemo(
    () => validateModeledMethods(modeledMethods),
    [modeledMethods],
  );

  const handleAddClick = useCallback(() => {
    const newModeledMethod: ModeledMethod = {
      type: "none",
      input: "",
      output: "",
      kind: "",
      provenance: "manual",
      signature: method.signature,
      packageName: method.packageName,
      typeName: method.typeName,
      methodName: method.methodName,
      methodParameters: method.methodParameters,
    };

    const newModeledMethods = [...modeledMethods, newModeledMethod];

    onChange(method.signature, newModeledMethods);
    selectNewMethod.current = newModeledMethods.length - 1;
  }, [onChange, modeledMethods, method]);

  const handleRemoveClick = useCallback(() => {
    const newModeledMethods = modeledMethods.filter(
      (_, index) => index !== selectedIndex,
    );

    const newSelectedIndex =
      selectedIndex === newModeledMethods.length
        ? selectedIndex - 1
        : selectedIndex;

    onChange(method.signature, newModeledMethods);
    setSelectedIndex(newSelectedIndex);
  }, [onChange, modeledMethods, selectedIndex, method]);

  const handleChange = useCallback(
    (modeledMethod: ModeledMethod) => {
      if (modeledMethods.length > 0) {
        const newModeledMethods = [...modeledMethods];
        newModeledMethods[selectedIndex] = modeledMethod;
        onChange(method.signature, newModeledMethods);
      } else {
        onChange(method.signature, [modeledMethod]);
      }
    },
    [modeledMethods, selectedIndex, onChange, method],
  );

  return (
    <Container>
      {validationErrors.length > 0 && (
        <AlertContainer>
          {validationErrors.map((error, index) => (
            <ModeledMethodAlert
              key={index}
              error={error}
              setSelectedIndex={setSelectedIndex}
            />
          ))}
        </AlertContainer>
      )}
      {modeledMethods.length > 0 ? (
        <MethodModelingInputs
          language={language}
          method={method}
          modeledMethod={modeledMethods[selectedIndex]}
          isModelingInProgress={isModelingInProgress}
          onChange={handleChange}
        />
      ) : (
        <MethodModelingInputs
          language={language}
          method={method}
          modeledMethod={undefined}
          isModelingInProgress={isModelingInProgress}
          onChange={handleChange}
        />
      )}
      <Footer>
        <PaginationActions>
          <VSCodeButton
            appearance="icon"
            aria-label="Previous modeling"
            onClick={handlePreviousClick}
            disabled={modeledMethods.length < 2 || selectedIndex === 0}
          >
            <Codicon name="chevron-left" />
          </VSCodeButton>
          {modeledMethods.length > 1 && (
            <div>
              {selectedIndex + 1}/{modeledMethods.length}
            </div>
          )}
          <VSCodeButton
            appearance="icon"
            aria-label="Next modeling"
            onClick={handleNextClick}
            disabled={
              modeledMethods.length < 2 ||
              selectedIndex === modeledMethods.length - 1
            }
          >
            <Codicon name="chevron-right" />
          </VSCodeButton>
        </PaginationActions>
        <ModificationActions>
          <VSCodeButton
            appearance="icon"
            aria-label="Delete modeling"
            onClick={handleRemoveClick}
            disabled={!canRemoveModeledMethod(modeledMethods)}
          >
            <Codicon name="trash" />
          </VSCodeButton>
          <VSCodeButton
            appearance="icon"
            aria-label="Add modeling"
            onClick={handleAddClick}
            disabled={!canAddNewModeledMethod(modeledMethods)}
          >
            <Codicon name="add" />
          </VSCodeButton>
        </ModificationActions>
      </Footer>
    </Container>
  );
};
