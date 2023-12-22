import { useCallback } from "react";
import { vscode } from "../vscode-api";
import { styled } from "styled-components";
import TextButton from "../common/TextButton";
import { ResponsiveContainer } from "../common/ResponsiveContainer";

const Button = styled(TextButton)`
  margin-top: 0.2rem;
`;

export const NotInModelingMode = () => {
  const handleClick = useCallback(() => {
    vscode.postMessage({
      t: "startModeling",
    });
  }, []);

  return (
    <ResponsiveContainer>
      <span>Not in modeling mode</span>
      <Button onClick={handleClick}>Start modeling</Button>
    </ResponsiveContainer>
  );
};
