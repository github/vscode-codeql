import * as React from "react";
import { useMemo } from "react";
import {
  CallClassification,
  ExternalApiUsage,
} from "../../data-extensions-editor/external-api-usage";
import { VSCodeTag } from "@vscode/webview-ui-toolkit/react";
import styled from "styled-components";

const ClassificationsContainer = styled.div`
  display: inline-flex;
  flex-direction: row;
  gap: 0.5rem;
`;

type Props = {
  externalApiUsage: ExternalApiUsage;
};

export const MethodClassifications = ({ externalApiUsage }: Props) => {
  const allUsageClassifications = useMemo(
    () =>
      new Set(
        externalApiUsage.usages.map((usage) => {
          return usage.classification;
        }),
      ),
    [externalApiUsage.usages],
  );

  const inSource = allUsageClassifications.has(CallClassification.Source);
  const inTest = allUsageClassifications.has(CallClassification.Test);
  const inGenerated = allUsageClassifications.has(CallClassification.Generated);

  if (inSource) {
    return null;
  }

  return (
    <ClassificationsContainer>
      {inTest && <VSCodeTag>Test</VSCodeTag>}
      {inGenerated && <VSCodeTag>Generated</VSCodeTag>}
    </ClassificationsContainer>
  );
};
