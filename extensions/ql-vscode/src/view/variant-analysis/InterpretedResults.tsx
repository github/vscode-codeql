import * as React from "react";
import styled from "styled-components";
import { VariableSizeList } from "react-window";
import { AnalysisAlert } from "../../remote-queries/shared/analysis-result";
import AnalysisAlertResult from "../remote-queries/AnalysisAlertResult";
import { useCallback } from "react";

const Container = styled(VariableSizeList)`
  list-style-type: none;
  margin: 1em 0 0;
  padding: 0.5em 0 0 0;
`;

const InterpretedResultItem = styled.li`
  margin-bottom: 1em;
  background-color: var(--vscode-notifications-background);
`;

export type InterpretedResultsProps = {
  interpretedResults: AnalysisAlert[];
};

export const InterpretedResults = ({
  interpretedResults,
}: InterpretedResultsProps) => {
  const itemSize = useCallback(
    (index: number) => {
      const alert = interpretedResults[index];

      // TODO: Determine whether we can use this value or whether it should be calculated.
      const baseHeight = 130;

      // TODO: Take into account wrapping?
      const codeSnippetLines = alert.codeSnippet?.text.split("\n").length ?? 0;
      // TODO: Use actual line size
      const codeSnippetHeight = codeSnippetLines * 16;

      // TODO: Take into account wrapping?
      const messageLines = alert.message.tokens.reduce(
        (acc, t) => acc + t.text.split("\n").length - 1,
        1,
      );
      // TODO: Use actual line size
      const messageHeight = messageLines * 16;

      return baseHeight + messageHeight + codeSnippetHeight;
    },
    [interpretedResults],
  );

  return (
    <Container
      // TODO: Set this height properly. Normally, this would be based on the height of the parent element, but since
      // we're in an expanded panel, we can't use that. Therefore, we should find some other method, the simplest of
      // which would just have a fixed height for this panel.
      height={500}
      itemCount={interpretedResults.length}
      itemSize={itemSize}
      width="100%"
    >
      {({ index, style }) => (
        <InterpretedResultItem style={style}>
          <AnalysisAlertResult alert={interpretedResults[index]} />
        </InterpretedResultItem>
      )}
    </Container>
  );
};
