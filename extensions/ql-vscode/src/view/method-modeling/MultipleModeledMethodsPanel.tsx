import * as React from "react";
import { useCallback, useState } from "react";
import { Method } from "../../model-editor/method";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { styled } from "styled-components";
import { MethodModelingInputs } from "./MethodModelingInputs";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { Codicon } from "../common";

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
  border-bottom: 0.05rem solid var(--vscode-panelSection-border);
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

  return (
    <Container>
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
