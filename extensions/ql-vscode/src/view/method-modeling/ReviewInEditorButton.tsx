import { useCallback } from "react";
import { styled } from "styled-components";
import { vscode } from "../vscode-api";
import TextButton from "../common/TextButton";
import type { Method } from "../../model-editor/method";

const Button = styled(TextButton)`
  margin-top: 0.7rem;
`;

type Props = {
  method: Method;
};

export const ReviewInEditorButton = ({ method }: Props) => {
  const handleClick = useCallback(() => {
    vscode.postMessage({
      t: "revealInModelEditor",
      method,
    });
  }, [method]);

  return <Button onClick={handleClick}>Review in editor</Button>;
};
