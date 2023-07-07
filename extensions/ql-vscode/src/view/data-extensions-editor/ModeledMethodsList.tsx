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
import { DataExtensionEditorViewState } from "../../data-extensions-editor/shared/view-state";

type Props = {
  externalApiUsages: ExternalApiUsage[];
  unsavedModels: Set<string>;
  modeledMethods: Record<string, ModeledMethod>;
  viewState: DataExtensionEditorViewState | undefined;
  mode: Mode;
  onChange: (
    modelName: string,
    externalApiUsage: ExternalApiUsage,
    modeledMethod: ModeledMethod,
  ) => void;
  onSaveModelClick: (
    modelName: string,
    externalApiUsages: ExternalApiUsage[],
    modeledMethods: Record<string, ModeledMethod>,
  ) => void;
};

export const ModeledMethodsList = ({
  externalApiUsages,
  unsavedModels,
  modeledMethods,
  viewState,
  mode,
  onChange,
  onSaveModelClick,
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
          hasUnsavedChanges={unsavedModels.has(libraryName)}
          modeledMethods={modeledMethods}
          viewState={viewState}
          mode={mode}
          onChange={onChange}
          onSaveModelClick={onSaveModelClick}
        />
      ))}
    </>
  );
};
