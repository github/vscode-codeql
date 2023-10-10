import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import { Method } from "../../model-editor/method";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { styled } from "styled-components";
import { MethodModelingInputs } from "./MethodModelingInputs";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { Codicon } from "../common";
import { validateModeledMethods } from "../../model-editor/shared/validation";
import { ModeledMethodAlert } from "./ModeledMethodAlert";

export type MultipleModeledMethodsPanelProps = {
  method: Method;
  modeledMethods: ModeledMethod[];
  onChange: (modeledMethod: ModeledMethod) => void;
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
`;

const PaginationActions = styled.div`
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
`;

export const MultipleModeledMethodsPanel = ({
  method,
  modeledMethods,
  onChange,
}: MultipleModeledMethodsPanelProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

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
          method={method}
          modeledMethod={modeledMethods[selectedIndex]}
          onChange={onChange}
        />
      ) : (
        <MethodModelingInputs
          method={method}
          modeledMethod={undefined}
          onChange={onChange}
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
      </Footer>
    </Container>
  );
};
