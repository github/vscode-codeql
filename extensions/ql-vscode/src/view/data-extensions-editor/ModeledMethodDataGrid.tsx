import * as React from "react";
import {
  VSCodeDataGrid,
  VSCodeDataGridCell,
  VSCodeDataGridRow,
} from "@vscode/webview-ui-toolkit/react";
import { MethodRow } from "./MethodRow";
import { ExternalApiUsage } from "../../data-extensions-editor/external-api-usage";
import { ModeledMethod } from "../../data-extensions-editor/modeled-method";
import { useMemo } from "react";
import { Mode } from "../../data-extensions-editor/shared/mode";
import { sortMethods } from "../../data-extensions-editor/shared/sorting";

type Props = {
  externalApiUsages: ExternalApiUsage[];
  modeledMethods: Record<string, ModeledMethod>;
  modifiedSignatures: Set<string>;
  mode: Mode;
  onChange: (
    externalApiUsage: ExternalApiUsage,
    modeledMethod: ModeledMethod,
  ) => void;
};

export const ModeledMethodDataGrid = ({
  externalApiUsages,
  modeledMethods,
  modifiedSignatures,
  mode,
  onChange,
}: Props) => {
  const sortedExternalApiUsages = useMemo(
    () => sortMethods(externalApiUsages),
    [externalApiUsages],
  );

  return (
    <VSCodeDataGrid gridTemplateColumns="0.4fr 0.15fr 0.15fr 0.15fr 0.15fr">
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
          modifiedSignatures={modifiedSignatures}
          mode={mode}
          onChange={onChange}
        />
      ))}
    </VSCodeDataGrid>
  );
};
