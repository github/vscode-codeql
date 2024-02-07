import { useCallback } from "react";
import type { TypeModeledMethod } from "../../model-editor/modeled-method";
import type { AccessPathOption } from "../../model-editor/suggestions";
import { AccessPathSuggestBox } from "./AccessPathSuggestBox";

type Props = {
  modeledMethod: TypeModeledMethod;
  suggestions: AccessPathOption[];
  onChange: (modeledMethod: TypeModeledMethod) => void;
};

export const ModelTypePathSuggestBox = ({
  modeledMethod,
  suggestions,
  onChange,
}: Props) => {
  const handleChange = useCallback(
    (path: string | undefined) => {
      if (path === undefined) {
        return;
      }

      onChange({
        ...modeledMethod,
        path,
      });
    },
    [modeledMethod, onChange],
  );

  return (
    <AccessPathSuggestBox
      value={modeledMethod.path}
      suggestions={suggestions}
      onChange={handleChange}
      aria-label="Path"
    />
  );
};
