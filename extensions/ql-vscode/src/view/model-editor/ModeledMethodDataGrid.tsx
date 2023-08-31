import * as React from "react";
import {
  VSCodeDataGrid,
  VSCodeDataGridCell,
  VSCodeDataGridRow,
} from "@vscode/webview-ui-toolkit/react";
import { MethodRow } from "./MethodRow";
import { ExternalApiUsage } from "../../model-editor/external-api-usage";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { useMemo } from "react";
import { Mode } from "../../model-editor/shared/mode";
import { sortMethods } from "../../model-editor/shared/sorting";
import { InProgressMethods } from "../../model-editor/shared/in-progress-methods";

type Props = {
  packageName: string;
  externalApiUsages: ExternalApiUsage[];
  modeledMethods: Record<string, ModeledMethod>;
  modifiedSignatures: Set<string>;
  inProgressMethods: InProgressMethods;
  mode: Mode;
  hideModeledApis: boolean;
  onChange: (
    externalApiUsage: ExternalApiUsage,
    modeledMethod: ModeledMethod,
  ) => void;
};

export const ModeledMethodDataGrid = ({
  packageName,
  externalApiUsages,
  modeledMethods,
  modifiedSignatures,
  inProgressMethods,
  mode,
  hideModeledApis,
  onChange,
}: Props) => {
  const sortedExternalApiUsages = useMemo(
    () => sortMethods(externalApiUsages),
    [externalApiUsages],
  );

  return (
    <VSCodeDataGrid gridTemplateColumns="0.5fr 0.125fr 0.125fr 0.125fr 0.125fr">
      <VSCodeDataGridRow rowType="header">
        <VSCodeDataGridCell cellType="columnheader" gridColumn={1}>
          API or method
        </VSCodeDataGridCell>
        <VSCodeDataGridCell cellType="columnheader" gridColumn={2}>
          Model type
        </VSCodeDataGridCell>
        <VSCodeDataGridCell cellType="columnheader" gridColumn={3}>
          Input
        </VSCodeDataGridCell>
        <VSCodeDataGridCell cellType="columnheader" gridColumn={4}>
          Output
        </VSCodeDataGridCell>
        <VSCodeDataGridCell cellType="columnheader" gridColumn={5}>
          Kind
        </VSCodeDataGridCell>
      </VSCodeDataGridRow>
      {sortedExternalApiUsages.map((externalApiUsage) => (
        <MethodRow
          key={externalApiUsage.signature}
          externalApiUsage={externalApiUsage}
          modeledMethod={modeledMethods[externalApiUsage.signature]}
          methodIsUnsaved={modifiedSignatures.has(externalApiUsage.signature)}
          modelingInProgress={inProgressMethods.hasMethod(
            packageName,
            externalApiUsage.signature,
          )}
          mode={mode}
          hideModeledApis={hideModeledApis}
          onChange={onChange}
        />
      ))}
    </VSCodeDataGrid>
  );
};
