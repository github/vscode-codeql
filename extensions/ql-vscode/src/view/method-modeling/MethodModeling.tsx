import { styled } from "styled-components";
import type { ModelingStatus } from "../../model-editor/shared/modeling-status";
import { ModelingStatusIndicator } from "../model-editor/ModelingStatusIndicator";
import type { Method } from "../../model-editor/method";
import { MethodName } from "../model-editor/MethodName";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import { VSCodeTag } from "@vscode/webview-ui-toolkit/react";
import { ReviewInEditorButton } from "./ReviewInEditorButton";
import { MultipleModeledMethodsPanel } from "./MultipleModeledMethodsPanel";
import type { QueryLanguage } from "../../common/query-language";
import type { ModelConfig } from "../../model-editor/languages";

const Container = styled.div`
  padding-top: 0.5rem;
  margin-bottom: 1rem;
  width: 100%;
`;

const Title = styled.div`
  padding-bottom: 0.5rem;
  font-size: 0.9rem;
  text-transform: uppercase;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const DependencyContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5em;
  background-color: var(--vscode-editor-background);
  border: 0.05rem solid var(--vscode-panelSection-border);
  border-radius: 0.3rem;
  padding: 0.5rem;
  word-wrap: break-word;
  word-break: break-all;
  margin-bottom: 0.8rem;
`;

const StyledVSCodeTag = styled(VSCodeTag)<{ $visible: boolean }>`
  visibility: ${(props) => (props.$visible ? "visible" : "hidden")};
`;

const UnsavedTag = ({ modelingStatus }: { modelingStatus: ModelingStatus }) => (
  <StyledVSCodeTag $visible={modelingStatus === "unsaved"}>
    Unsaved
  </StyledVSCodeTag>
);

export type MethodModelingProps = {
  language: QueryLanguage;
  modelConfig: ModelConfig;
  modelingStatus: ModelingStatus;
  method: Method;
  modeledMethods: ModeledMethod[];
  onChange: (methodSignature: string, modeledMethods: ModeledMethod[]) => void;
};

export const MethodModeling = ({
  language,
  modelConfig,
  modelingStatus,
  modeledMethods,
  method,
  onChange,
}: MethodModelingProps): React.JSX.Element => {
  return (
    <Container>
      <Title>
        {method.packageName}
        {method.libraryVersion && <>@{method.libraryVersion}</>}
        <UnsavedTag modelingStatus={modelingStatus} />
      </Title>
      <DependencyContainer>
        <ModelingStatusIndicator status={modelingStatus} />
        <MethodName {...method} />
      </DependencyContainer>
      <MultipleModeledMethodsPanel
        language={language}
        modelConfig={modelConfig}
        method={method}
        modeledMethods={modeledMethods}
        onChange={onChange}
      />
      <ReviewInEditorButton method={method} />
    </Container>
  );
};
