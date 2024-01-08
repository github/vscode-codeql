import { useMemo } from "react";
import type { Method } from "../../model-editor/method";
import { CallClassification } from "../../model-editor/method";
import { VSCodeTag } from "@vscode/webview-ui-toolkit/react";
import { styled } from "styled-components";

const ClassificationsContainer = styled.div`
  display: inline-flex;
  flex-direction: row;
  gap: 0.5rem;
`;

const ClassificationTag = styled(VSCodeTag)`
  font-size: 0.75em;
  white-space: nowrap;
`;

type Props = {
  method: Method;
};

export const MethodClassifications = ({ method }: Props) => {
  const allUsageClassifications = useMemo(
    () =>
      new Set(
        method.usages.map((usage) => {
          return usage.classification;
        }),
      ),
    [method.usages],
  );

  const inSource = allUsageClassifications.has(CallClassification.Source);
  const inTest = allUsageClassifications.has(CallClassification.Test);
  const inGenerated = allUsageClassifications.has(CallClassification.Generated);

  const tooltip = useMemo(() => {
    if (inTest && inGenerated) {
      return "This method is only used from test and generated code";
    }
    if (inTest) {
      return "This method is only used from test code";
    }
    if (inGenerated) {
      return "This method is only used from generated code";
    }
    return "";
  }, [inTest, inGenerated]);

  if (inSource) {
    return null;
  }

  return (
    <ClassificationsContainer title={tooltip}>
      {inTest && <ClassificationTag>Test</ClassificationTag>}
      {inGenerated && <ClassificationTag>Generated</ClassificationTag>}
    </ClassificationsContainer>
  );
};
