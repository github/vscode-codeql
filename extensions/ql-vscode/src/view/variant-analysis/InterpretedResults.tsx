import * as React from "react";
import styled from "styled-components";
import { AnalysisAlert } from "../../remote-queries/shared/analysis-result";
import AnalysisAlertResult from "../remote-queries/AnalysisAlertResult";

const Container = styled.ul`
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
  return (
    <Container>
      {interpretedResults.map((r, i) => (
        <InterpretedResultItem key={i}>
          <AnalysisAlertResult alert={r} />
        </InterpretedResultItem>
      ))}
    </Container>
  );
};
