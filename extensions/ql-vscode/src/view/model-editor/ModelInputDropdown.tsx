import * as React from "react";
import { ChangeEvent, useCallback, useMemo } from "react";
import { Dropdown } from "../common/Dropdown";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { Method, getArgumentsList } from "../../model-editor/method";

type Props = {
  method: Method;
  modeledMethod: ModeledMethod | undefined;
  onChange: (method: Method, modeledMethod: ModeledMethod) => void;
};

export const ModelInputDropdown = ({
  method,
  modeledMethod,
  onChange,
}: Props): JSX.Element => {
  const argumentsList = useMemo(
    () => getArgumentsList(method.methodParameters),
    [method.methodParameters],
  );

  const options = useMemo(
    () => [
      { value: "Argument[this]", label: "Argument[this]" },
      ...argumentsList.map((argument, index) => ({
        value: `Argument[${index}]`,
        label: `Argument[${index}]: ${argument}`,
      })),
    ],
    [argumentsList],
  );

  const enabled = useMemo(
    () =>
      modeledMethod?.type && ["sink", "summary"].includes(modeledMethod?.type),
    [modeledMethod?.type],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      if (!modeledMethod) {
        return;
      }

      const target = e.target as HTMLSelectElement;

      onChange(method, {
        ...modeledMethod,
        input: target.value,
      });
    },
    [onChange, method, modeledMethod],
  );

  return (
    <Dropdown
      value={modeledMethod?.input}
      options={options}
      disabled={!enabled}
      onChange={handleChange}
      aria-label="Input"
    />
  );
};
