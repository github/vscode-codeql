import { styled } from "styled-components";

const Name = styled.span`
  font-family: var(--vscode-editor-font-family);
  word-break: break-all;
`;

const TypeMethodName = ({
  typeName,
  methodName,
}: {
  typeName?: string;
  methodName?: string;
}) => {
  if (!typeName) {
    return <>{methodName}</>;
  }

  if (!methodName) {
    return <>{typeName}</>;
  }

  return (
    <>
      {typeName}.{methodName}
    </>
  );
};

export const MethodName = ({
  packageName,
  typeName,
  methodName,
  methodParameters,
}: {
  packageName: string;
  typeName?: string;
  methodName?: string;
  methodParameters?: string;
}): React.JSX.Element => {
  return (
    <Name>
      {packageName && <>{packageName}.</>}
      <TypeMethodName typeName={typeName} methodName={methodName} />
      {methodParameters}
    </Name>
  );
};
