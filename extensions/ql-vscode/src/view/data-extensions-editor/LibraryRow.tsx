import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import styled from "styled-components";
import { ExternalApiUsage } from "../../data-extensions-editor/external-api-usage";
import { ModeledMethod } from "../../data-extensions-editor/modeled-method";
import { ModeledMethodDataGrid } from "./ModeledMethodDataGrid";
import { calculateModeledPercentage } from "./modeled";
import { decimalFormatter, percentFormatter } from "./formatters";

const LibraryContainer = styled.div`
  margin-bottom: 1rem;
`;

const TitleContainer = styled.button`
  display: flex;
  gap: 0.5em;
  align-items: center;
  width: 100%;
  font-size: 1.2em;
  font-weight: bold;

  color: var(--vscode-editor-foreground);
  background-color: transparent;
  border: none;
  cursor: pointer;
`;

const StatusContainer = styled.div`
  display: flex;
  gap: 1em;
  align-items: center;

  margin-top: 0.5em;
  margin-bottom: 0.5em;
  margin-left: 1em;
`;

type Props = {
  libraryName: string;
  externalApiUsages: ExternalApiUsage[];
  modeledMethods: Record<string, ModeledMethod>;
  onChange: (
    externalApiUsage: ExternalApiUsage,
    modeledMethod: ModeledMethod,
  ) => void;
};

export const LibraryRow = ({
  libraryName,
  externalApiUsages,
  modeledMethods,
  onChange,
}: Props) => {
  const modeledPercentage = useMemo(() => {
    return calculateModeledPercentage(externalApiUsages);
  }, [externalApiUsages]);

  const [isExpanded, setExpanded] = useState(modeledPercentage < 100);

  const toggleExpanded = useCallback(async () => {
    setExpanded((oldIsExpanded) => !oldIsExpanded);
  }, []);

  const usagesCount = useMemo(() => {
    return externalApiUsages.reduce((acc, curr) => acc + curr.usages.length, 0);
  }, [externalApiUsages]);

  return (
    <LibraryContainer>
      <TitleContainer onClick={toggleExpanded} aria-expanded={isExpanded}>
        {libraryName}
        {isExpanded ? null : (
          <>
            {" "}
            ({decimalFormatter.format(externalApiUsages.length)} method
            {externalApiUsages.length !== 1 ? "s" : ""},{" "}
            {percentFormatter.format(modeledPercentage / 100)} modeled)
          </>
        )}
      </TitleContainer>
      {isExpanded && (
        <>
          <StatusContainer>
            <div>
              {decimalFormatter.format(externalApiUsages.length)} method
              {externalApiUsages.length !== 1 ? "s" : ""}
            </div>
            <div>
              {decimalFormatter.format(usagesCount)} usage
              {usagesCount !== 1 ? "s" : ""}
            </div>
            <div>
              {percentFormatter.format(modeledPercentage / 100)} modeled
            </div>
          </StatusContainer>
          <ModeledMethodDataGrid
            externalApiUsages={externalApiUsages}
            modeledMethods={modeledMethods}
            onChange={onChange}
          />
        </>
      )}
    </LibraryContainer>
  );
};
