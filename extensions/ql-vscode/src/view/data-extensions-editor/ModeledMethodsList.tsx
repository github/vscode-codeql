import * as React from "react";
import { useMemo } from "react";
import { ExternalApiUsage } from "../../data-extensions-editor/external-api-usage";
import { ModeledMethod } from "../../data-extensions-editor/modeled-method";
import { LibraryRow } from "./LibraryRow";
import { Mode } from "../../data-extensions-editor/shared/mode";
import {
  groupMethods,
  sortGroupNames,
} from "../../data-extensions-editor/shared/sorting";

type Props = {
  externalApiUsages: ExternalApiUsage[];
  modeledMethods: Record<string, ModeledMethod>;
  mode: Mode;
  onChange: (
    externalApiUsage: ExternalApiUsage,
    modeledMethod: ModeledMethod,
  ) => void;
};

export const ModeledMethodsList = ({
  externalApiUsages,
  modeledMethods,
  mode,
  onChange,
}: Props) => {
  const grouped = useMemo(
    () => groupMethods(externalApiUsages, mode),
    [externalApiUsages, mode],
  );

  const sortedGroupNames = useMemo(() => sortGroupNames(grouped), [grouped]);

  return (
    <>
      {sortedGroupNames.map((libraryName) => (
        <LibraryRow
          key={libraryName}
          title={libraryName}
          externalApiUsages={grouped[libraryName]}
          modeledMethods={modeledMethods}
          mode={mode}
          onChange={onChange}
        />
      ))}
    </>
  );
};
