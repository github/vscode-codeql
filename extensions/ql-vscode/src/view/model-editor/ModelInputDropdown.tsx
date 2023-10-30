import * as React from "react";
import { ChangeEvent, useCallback, useMemo } from "react";
import { Dropdown } from "../common/Dropdown";
import {
  ModeledMethod,
  modeledMethodSupportsInput,
} from "../../model-editor/modeled-method";
import { Method, getArgumentsList } from "../../model-editor/method";

type Props = {
  method: Method;
  modeledMethod: ModeledMethod | undefined;
  onChange: (modeledMethod: ModeledMethod) => void;
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
    () => modeledMethod && modeledMethodSupportsInput(modeledMethod),
    [modeledMethod],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      if (!modeledMethod || !modeledMethodSupportsInput(modeledMethod)) {
        return;
      }

      const target = e.target as HTMLSelectElement;

      onChange({
        ...modeledMethod,
        input: target.value,
      });
    },
    [onChange, modeledMethod],
  );

  const value =
    modeledMethod && modeledMethodSupportsInput(modeledMethod)
      ? modeledMethod.input
      : undefined;

  return (
    <Dropdown
      value={value}
      options={options}
      disabled={!enabled}
      onChange={handleChange}
      aria-label="Input"
    />
  );
};
