import * as React from "react";
import { ChangeEvent, useCallback, useMemo } from "react";
import { Dropdown } from "../common/Dropdown";
import {
  ModeledMethod,
  ModeledMethodType,
  Provenance,
} from "../../model-editor/modeled-method";
import { Method, getArgumentsList } from "../../model-editor/method";

const options: Array<{ value: ModeledMethodType; label: string }> = [
  { value: "none", label: "Unmodeled" },
  { value: "source", label: "Source" },
  { value: "sink", label: "Sink" },
  { value: "summary", label: "Flow summary" },
  { value: "neutral", label: "Neutral" },
];

type Props = {
  method: Method;
  modeledMethod: ModeledMethod | undefined;
  onChange: (modeledMethod: ModeledMethod) => void;
};

export const ModelTypeDropdown = ({
  method,
  modeledMethod,
  onChange,
}: Props): JSX.Element => {
  const argumentsList = useMemo(
    () => getArgumentsList(method.methodParameters),
    [method.methodParameters],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      let newProvenance: Provenance = "manual";
      if (modeledMethod?.provenance === "df-generated") {
        newProvenance = "df-manual";
      } else if (modeledMethod?.provenance === "ai-generated") {
        newProvenance = "ai-manual";
      }

      const updatedModeledMethod: ModeledMethod = {
        // If there are no arguments, we will default to "Argument[this]"
        input: argumentsList.length === 0 ? "Argument[this]" : "Argument[0]",
        output: "ReturnValue",
        kind: "value",
        type: e.target.value as ModeledMethodType,
        provenance: newProvenance,
        signature: method.signature,
        packageName: method.packageName,
        typeName: method.typeName,
        methodName: method.methodName,
        methodParameters: method.methodParameters,
      };
      onChange(updatedModeledMethod);
    },
    [onChange, method, modeledMethod, argumentsList],
  );

  return (
    <Dropdown
      value={modeledMethod?.type ?? "none"}
      options={options}
      onChange={handleChange}
      aria-label="Model type"
    />
  );
};
