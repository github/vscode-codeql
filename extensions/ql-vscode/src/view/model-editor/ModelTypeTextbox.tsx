import type { ChangeEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import type {
  ModeledMethod,
  TypeModeledMethod,
} from "../../model-editor/modeled-method";
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { useDebounceCallback } from "../common/useDebounceCallback";

type Props = {
  modeledMethod: TypeModeledMethod;
  typeInfo: "path" | "relatedTypeName";
  onChange: (modeledMethod: ModeledMethod) => void;

  "aria-label"?: string;
};

const stopClickPropagation = (e: React.MouseEvent) => {
  e.stopPropagation();
};

export const ModelTypeTextbox = ({
  modeledMethod,
  typeInfo,
  onChange,
  ...props
}: Props): React.JSX.Element => {
  const [value, setValue] = useState<string | undefined>(
    modeledMethod[typeInfo],
  );

  useEffect(() => {
    setValue(modeledMethod[typeInfo]);
  }, [modeledMethod, typeInfo]);

  const handleChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const target = e.target as HTMLSelectElement;

    setValue(target.value);
  }, []);

  // Debounce the callback to avoid updating the model too often.
  // Not doing this results in a lot of lag when typing.
  useDebounceCallback(
    value,
    (newValue: string | undefined) => {
      onChange({
        ...modeledMethod,
        [typeInfo]: newValue ?? "",
      });
    },
    500,
  );

  return (
    <VSCodeTextField
      value={value}
      onInput={handleChange}
      onClick={stopClickPropagation}
      {...props}
    />
  );
};
