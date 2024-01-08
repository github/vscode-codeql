import type { ModeledMethodValidationError } from "../../model-editor/shared/validation";
import TextButton from "../common/TextButton";
import { Alert } from "../common";
import { useCallback } from "react";

type Props = {
  error: ModeledMethodValidationError;
  setSelectedIndex?: (index: number) => void;
};

export const ModeledMethodAlert = ({ error, setSelectedIndex }: Props) => {
  const handleClick = useCallback(() => {
    setSelectedIndex?.(error.index);
  }, [error.index, setSelectedIndex]);

  return (
    <Alert
      role="alert"
      type="error"
      title={error.title}
      message={
        <>
          {error.message}{" "}
          {setSelectedIndex ? (
            <TextButton onClick={handleClick}>{error.actionText}</TextButton>
          ) : (
            error.actionText
          )}
        </>
      }
    />
  );
};
