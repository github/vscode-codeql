import * as React from "react";
import { styled } from "styled-components";
import { ExternalApiUsage } from "../../model-editor/external-api-usage";

const Name = styled.span`
  font-family: var(--vscode-editor-font-family);
`;

export const ExternalApiUsageName = (
  externalApiUsage: ExternalApiUsage,
): JSX.Element => {
  return (
    <Name>
      {externalApiUsage.packageName && <>{externalApiUsage.packageName}.</>}
      {externalApiUsage.typeName}.{externalApiUsage.methodName}
      {externalApiUsage.methodParameters}
    </Name>
  );
};
