import { styled } from "styled-components";
import { useEffect, useState } from "react";

import { useTelemetryOnChange } from "../common/telemetry";
import { CodeFlowsDropdown } from "../common/CodePaths/CodeFlowsDropdown";
import { SectionTitle, VerticalSpace } from "../common";
import { CodePath } from "../common/CodePaths/CodePath";
import type { DataFlowPaths as DataFlowPathsDomainModel } from "../../variant-analysis/shared/data-flow-paths";

const PathsContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const PathDetailsContainer = styled.div`
  padding: 0;
  border: 0;
`;

const PathDropdownContainer = styled.div`
  flex-grow: 1;
  padding: 0 0 0 0.2em;
  border: none;
`;

export type DataFlowPathsProps = {
  dataFlowPaths: DataFlowPathsDomainModel;
};

export const DataFlowPaths = ({
  dataFlowPaths,
}: {
  dataFlowPaths: DataFlowPathsDomainModel;
}): React.JSX.Element => {
  const [selectedCodeFlow, setSelectedCodeFlow] = useState(
    dataFlowPaths.codeFlows[0],
  );
  useTelemetryOnChange(selectedCodeFlow, "code-flow-selected");

  const { codeFlows, ruleDescription, message, severity } = dataFlowPaths;

  useEffect(() => {
    // Make sure to update the selected code flow if the data flow paths change
    setSelectedCodeFlow(dataFlowPaths.codeFlows[0]);
  }, [dataFlowPaths]);

  return (
    <>
      <VerticalSpace $size={2} />
      <SectionTitle>{ruleDescription}</SectionTitle>
      <VerticalSpace $size={2} />

      <PathsContainer>
        <PathDetailsContainer>
          {codeFlows.length} paths available:{" "}
          {selectedCodeFlow?.threadFlows.length} steps in
        </PathDetailsContainer>
        <PathDropdownContainer>
          <CodeFlowsDropdown
            codeFlows={codeFlows}
            selectedCodeFlow={selectedCodeFlow}
            setSelectedCodeFlow={setSelectedCodeFlow}
          />
        </PathDropdownContainer>
      </PathsContainer>

      <VerticalSpace $size={2} />
      <CodePath
        codeFlow={selectedCodeFlow}
        severity={severity}
        message={message}
      />
    </>
  );
};
