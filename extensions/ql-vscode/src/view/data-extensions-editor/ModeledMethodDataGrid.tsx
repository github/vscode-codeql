import * as React from "react";
import {
  VSCodeDataGrid,
  VSCodeDataGridCell,
  VSCodeDataGridRow,
} from "@vscode/webview-ui-toolkit/react";
import { MethodRow } from "./MethodRow";
import { ExternalApiUsage } from "../../data-extensions-editor/external-api-usage";
import { ModeledMethod } from "../../data-extensions-editor/modeled-method";

type Props = {
  externalApiUsages: ExternalApiUsage[];
  modeledMethods: Record<string, ModeledMethod>;
  onChange: (
    externalApiUsage: ExternalApiUsage,
    modeledMethod: ModeledMethod,
  ) => void;
};

export const ModeledMethodDataGrid = ({
  externalApiUsages,
  modeledMethods,
  onChange,
}: Props) => {
  return (
    <VSCodeDataGrid>
      <VSCodeDataGridRow rowType="header">
        <VSCodeDataGridCell cellType="columnheader" gridColumn={1}>
          Type
        </VSCodeDataGridCell>
        <VSCodeDataGridCell cellType="columnheader" gridColumn={2}>
          Method
        </VSCodeDataGridCell>
        <VSCodeDataGridCell cellType="columnheader" gridColumn={3}>
          Usages
        </VSCodeDataGridCell>
        <VSCodeDataGridCell cellType="columnheader" gridColumn={4}>
          Model type
        </VSCodeDataGridCell>
        <VSCodeDataGridCell cellType="columnheader" gridColumn={5}>
          Input
        </VSCodeDataGridCell>
        <VSCodeDataGridCell cellType="columnheader" gridColumn={6}>
          Output
        </VSCodeDataGridCell>
        <VSCodeDataGridCell cellType="columnheader" gridColumn={7}>
          Kind
        </VSCodeDataGridCell>
      </VSCodeDataGridRow>
      {externalApiUsages.map((externalApiUsage) => (
        <MethodRow
          key={externalApiUsage.signature}
          externalApiUsage={externalApiUsage}
          modeledMethod={modeledMethods[externalApiUsage.signature]}
          onChange={onChange}
        />
      ))}
    </VSCodeDataGrid>
  );
};
