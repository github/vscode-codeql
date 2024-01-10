import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { useDebounceCallback } from "../common/useDebounceCallback";

type Props = {
  modeledMethod: ModeledMethod | undefined;
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const ModelTypeTextbox = ({
  modeledMethod,
  onChange,
}: Props): JSX.Element => {
  const enabled = useMemo(
    () => modeledMethod && modeledMethod.type === "type",
    [modeledMethod],
  );
  const [value, setValue] = useState<string | undefined>(
    modeledMethod && modeledMethod.type === "type"
      ? modeledMethod.path
      : undefined,
  );

  useEffect(() => {
    if (modeledMethod && modeledMethod.type === "type") {
      setValue(modeledMethod.path);
    }
  }, [modeledMethod]);

  const handleChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const target = e.target as HTMLSelectElement;

    setValue(target.value);
  }, []);

  // Debounce the callback to avoid updating the model too often.
  // Not doing this results in a lot of lag when typing.
  useDebounceCallback(
    value,
    (path: string | undefined) => {
      if (!modeledMethod || modeledMethod.type !== "type") {
        return;
      }

      onChange({
        ...modeledMethod,
        path: path ?? "",
      });
    },
    500,
  );

  return (
    <VSCodeTextField
      value={value}
      onInput={handleChange}
      aria-label="Path"
      disabled={!enabled}
    />
  );
};
