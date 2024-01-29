import { styled } from "styled-components";
import type { Method } from "../../model-editor/method";

const Name = styled.span`
  font-family: var(--vscode-editor-font-family);
  word-break: break-all;
`;

const TypeMethodName = (method: Method) => {
  if (!method.typeName) {
    return <>{method.methodName}</>;
  }

  if (!method.methodName) {
    return <>{method.typeName}</>;
  }

  return (
    <>
      {method.typeName}.{method.methodName}
    </>
  );
};

export const MethodName = (method: Method): React.JSX.Element => {
  return (
    <Name>
      {method.packageName && <>{method.packageName}.</>}
      <TypeMethodName {...method} />
      {method.methodParameters}
    </Name>
  );
};
