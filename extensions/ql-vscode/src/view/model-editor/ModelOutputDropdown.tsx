import * as React from "react";
import { ChangeEvent, useCallback, useMemo } from "react";
import { Dropdown } from "../common/Dropdown";
import {
  ModeledMethod,
  modeledMethodSupportsOutput,
} from "../../model-editor/modeled-method";
import { Method, getArgumentsList } from "../../model-editor/method";

type Props = {
  method: Method;
  modeledMethod: ModeledMethod | undefined;
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const ModelOutputDropdown = ({
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
      { value: "ReturnValue", label: "ReturnValue" },
      { value: "Argument[this]", label: "Argument[this]" },
      ...argumentsList.map((argument, index) => ({
        value: `Argument[${index}]`,
        label: `Argument[${index}]: ${argument}`,
      })),
    ],
    [argumentsList],
  );

  const enabled = useMemo(
    () => modeledMethod && modeledMethodSupportsOutput(modeledMethod),
    [modeledMethod],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      if (!modeledMethod || !modeledMethodSupportsOutput(modeledMethod)) {
        return;
      }

      const target = e.target as HTMLSelectElement;

      onChange({
        ...modeledMethod,
        output: target.value,
      });
    },
    [onChange, modeledMethod],
  );

  const value =
    modeledMethod && modeledMethodSupportsOutput(modeledMethod)
      ? modeledMethod.output
      : undefined;

  return (
    <Dropdown
      value={value}
      options={options}
      disabled={!enabled}
      onChange={handleChange}
      aria-label="Output"
    />
  );
};
