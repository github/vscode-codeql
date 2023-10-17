import * as React from "react";
import { styled } from "styled-components";
import { Method } from "../../model-editor/method";

const Name = styled.span`
  font-family: var(--vscode-editor-font-family);
  word-break: break-all;
`;

export const MethodName = (method: Method): JSX.Element => {
  return (
    <Name>
      {method.packageName && <>{method.packageName}.</>}
      {method.typeName}.{method.methodName}
      {method.methodParameters}
    </Name>
  );
};
