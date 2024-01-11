import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
};

export const ModelTypeTextbox = ({
  modeledMethod,
  typeInfo,
  onChange,
}: Props): JSX.Element => {
  const enabled = useMemo(() => modeledMethod, [modeledMethod]);
  const [value, setValue] = useState<string | undefined>(
    modeledMethod[typeInfo],
  );

  useEffect(() => {
    if (modeledMethod) {
      setValue(modeledMethod[typeInfo]);
    }
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
      if (!modeledMethod) {
        return;
      }

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
      aria-label={typeInfo === "path" ? "Path" : "Related type name"}
      disabled={!enabled}
    />
  );
};
